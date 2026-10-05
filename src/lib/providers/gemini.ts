import { GoogleGenAI } from '@google/genai';
import { getTierConfig, calculateCostMicro } from '@/config/pricing';
import { ModelProvider, ModelCallParams, CallResult } from './types';
import { persistCall, buildMockResult } from './shared';

const PROVIDER_ID = 'gemini' as const;

let aiInstance: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

async function executeCall(params: ModelCallParams): Promise<CallResult> {
  const { messageId, tier, prompt, systemContext = '', history = [] } = params;
  const config = getTierConfig(tier, PROVIDER_ID);
  const start = performance.now();

  const client = getClient();

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

      const costMicro = calculateCostMicro(tier, inputTokens, outputTokens, cacheReadTokens, PROVIDER_ID);

      persistCall({
        messageId,
        model: config.model,
        tier,
        provider: PROVIDER_ID,
        inputTokens,
        cacheReadTokens,
        outputTokens,
        costMicro,
        latencyMs,
      });

      return {
        text,
        model: config.model,
        tier,
        provider: PROVIDER_ID,
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

  return buildMockResult({ messageId, tier, provider: PROVIDER_ID, model: config.model, prompt, start });
}

export const GeminiProvider: ModelProvider = {
  id: PROVIDER_ID,
  label: 'Google Gemini',
  executeCall,
};
