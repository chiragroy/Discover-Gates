import { GoogleGenAI } from '@google/genai';
import { Tier, TIER_CONFIGS, calculateCostMicro } from '@/config/pricing';
import db from '@/lib/db';
import crypto from 'crypto';

let aiInstance: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface CallResult {
  text: string;
  model: string;
  tier: Tier;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costMicro: number;
  latencyMs: number;
  isMock?: boolean;
}

/**
 * Executes call against Google GenAI with stable prefix construction,
 * token accounting, and micro-dollar cost ledger tracking.
 */
export async function executeModelCall(params: {
  messageId: string;
  tier: Tier;
  prompt: string;
  systemContext?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<CallResult> {
  const { messageId, tier, prompt, systemContext = '', history = [] } = params;
  const config = TIER_CONFIGS[tier];
  const start = performance.now();

  const client = getAIClient();

  // Stable prefix construction: System instructions and context first, variable user content last.
  const systemInstruction = [
    `You are Gatehouse Assistant, an AI advisor for legal, consulting, and accounting professionals.`,
    `Tone: Professional, direct, precise, clear, and citation-minded.`,
    systemContext,
  ]
    .filter(Boolean)
    .join('\n\n');

  // Truncate history to last 6 turns to prevent quadratic token growth
  const boundedHistory = history.slice(-6);

  if (client) {
    try {
      // Build contents
      const contents = [
        ...boundedHistory.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ];

      const response = await client.models.generateContent({
        model: config.model,
        contents,
        config: {
          systemInstruction,
          maxOutputTokens: config.maxOutputTokens,
          temperature: 0.2, // Low temperature for legal/accounting precision
        },
      });

      const latencyMs = Math.round(performance.now() - start);
      const text = response.text || '';

      const inputTokens = response.usageMetadata?.promptTokenCount ?? Math.ceil(prompt.length / 4);
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? Math.ceil(text.length / 4);
      const cacheReadTokens = response.usageMetadata?.cachedContentTokenCount ?? 0;

      const costMicro = calculateCostMicro(tier, inputTokens, outputTokens, cacheReadTokens);

      // Persist to calls table
      const callId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO calls (id, message_id, model, tier, input_tokens, cache_read_tokens, output_tokens, cost_micro, latency_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(callId, messageId, config.model, tier, inputTokens, cacheReadTokens, outputTokens, costMicro, latencyMs);

      return {
        text,
        model: config.model,
        tier,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        costMicro,
        latencyMs,
        isMock: false,
      };
    } catch (err) {
      console.warn('Gemini API call failed or rate-limited; falling back to simulated generation:', err);
    }
  }

  // Realistic mock response when GEMINI_API_KEY is not configured or in offline demo mode
  const latencyMs = Math.round(performance.now() - start) + 120;
  const mockText = generateProfessionalMockAnswer(prompt, tier);
  const inputTokens = Math.ceil(prompt.length / 3.8);
  const outputTokens = Math.ceil(mockText.length / 3.8);
  const cacheReadTokens = 0;
  const costMicro = calculateCostMicro(tier, inputTokens, outputTokens, cacheReadTokens);

  const callId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO calls (id, message_id, model, tier, input_tokens, cache_read_tokens, output_tokens, cost_micro, latency_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(callId, messageId, config.model, tier, inputTokens, cacheReadTokens, outputTokens, costMicro, latencyMs);

  return {
    text: mockText,
    model: config.model,
    tier,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    costMicro,
    latencyMs,
    isMock: true,
  };
}

function generateProfessionalMockAnswer(prompt: string, tier: Tier): string {
  const p = prompt.toLowerCase();
  if (p.includes('summarise') || p.includes('summarize')) {
    return (
      `**Summary:** The provision establishes a reciprocal indemnity obligation between the parties, ` +
      `capping maximum liability to the total aggregate fees paid under the Agreement in the preceding 12 months, ` +
      `expressly carving out gross negligence, willful misconduct, and breaches of confidentiality.`
    );
  }
  if (p.includes('indemnity cap') || p.includes('position')) {
    return (
      `**Position Memorandum: Indemnity Cap Negotiation**\n\n` +
      `1. **Standard Recommendation:** We recommend rejecting the counterparty's proposed uncapped indemnity for indirect damages.\n` +
      `2. **Market Position:** Commercial standard in software procurement limits aggregate exposure to 1x–2x 12-month trailing contract value.\n` +
      `3. **Carve-out Strategy:** Concede IP infringement and data breach carve-outs only subject to a distinct 'super-cap' of 3x contract value.`
    );
  }
  if (tier === 'deep') {
    return (
      `**Statutory & Contractual Analysis:**\n\n` +
      `Based on the provided facts and governing jurisdiction principles:\n` +
      `• **Primary Obligation:** The operative terms mandate compliance with statutory disclosure thresholds.\n` +
      `• **Risk Allocation:** The current draft allocates disproportionate consequential risk to our client.\n` +
      `• **Recommended Revision:** Insert an express knowledge qualifier and shorten the notice cure window to 15 business days.`
    );
  }
  return (
    `Based on professional review of your query regarding "${prompt.slice(0, 45)}...":\n` +
    `The operative terms comply with regulatory requirements. Proceed with standard documentation while noting client disclosure requirements.`
  );
}
