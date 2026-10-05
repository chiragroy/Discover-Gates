import OpenAI from 'openai';
import { getTierConfig, calculateCostMicro } from '@/config/pricing';
import { ModelProvider, ModelCallParams, CallResult } from './types';
import { persistCall, buildMockResult } from './shared';

const PROVIDER_ID = 'openai' as const;

let clientInstance: OpenAI | null = null;

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!clientInstance) {
    clientInstance = new OpenAI({ apiKey });
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
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemInstruction },
        ...boundedHistory.map(h => ({
          role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: h.content,
        })),
        { role: 'user', content: prompt },
      ];

      const response = await client.chat.completions.create({
        model: config.model,
        max_completion_tokens: config.maxOutputTokens,
        temperature: 0.2, // Low temperature for legal/accounting precision
        messages,
      });

      const latencyMs = Math.round(performance.now() - start);
      const text = response.choices[0]?.message?.content || '';

      const inputTokens = response.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
      const outputTokens = response.usage?.completion_tokens ?? Math.ceil(text.length / 4);
      const cacheReadTokens = response.usage?.prompt_tokens_details?.cached_tokens ?? 0;

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
      console.warn('OpenAI API call failed or rate-limited; falling back to simulated generation:', err);
    }
  }

  return buildMockResult({ messageId, tier, provider: PROVIDER_ID, model: config.model, prompt, start });
}

export const OpenAIProvider: ModelProvider = {
  id: PROVIDER_ID,
  label: 'OpenAI',
  executeCall,
};
