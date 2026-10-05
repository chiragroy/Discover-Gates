import Anthropic from '@anthropic-ai/sdk';
import { getTierConfig, calculateCostMicro } from '@/config/pricing';
import { ModelProvider, ModelCallParams, CallResult } from './types';
import { persistCall, buildMockResult } from './shared';

const PROVIDER_ID = 'claude' as const;

let clientInstance: Anthropic | null = null;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!clientInstance) {
    clientInstance = new Anthropic({ apiKey });
  }
  return clientInstance;
}

async function executeCall(params: ModelCallParams): Promise<CallResult> {
  const { messageId, tier, prompt, systemContext = '', history = [] } = params;
  const config = getTierConfig(tier, PROVIDER_ID);
  const start = performance.now();

  const client = getClient();

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
      const messages = [
        ...boundedHistory.map(h => ({
          role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: h.content,
        })),
        { role: 'user' as const, content: prompt },
      ];

      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxOutputTokens,
        temperature: 0.2, // Low temperature for legal/accounting precision
        system: systemInstruction,
        messages,
      });

      const latencyMs = Math.round(performance.now() - start);
      const text = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const cacheReadTokens = response.usage.cache_read_input_tokens ?? 0;

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
      console.warn('Claude API call failed or rate-limited; falling back to simulated generation:', err);
    }
  }

  return buildMockResult({ messageId, tier, provider: PROVIDER_ID, model: config.model, prompt, start });
}

export const ClaudeProvider: ModelProvider = {
  id: PROVIDER_ID,
  label: 'Anthropic Claude',
  executeCall,
};
