import { getActiveProvider, Provider } from '@/config/pricing';
import { GeminiProvider } from './gemini';
import { ClaudeProvider } from './claude';
import { OpenAIProvider } from './openai';
import { ModelProvider, ModelCallParams, CallResult } from './types';

const PROVIDERS: Record<Provider, ModelProvider> = {
  gemini: GeminiProvider,
  claude: ClaudeProvider,
  openai: OpenAIProvider,
};

/**
 * Returns whichever provider MODEL_PROVIDER selects (default: gemini).
 * This is the single switch point for moving all 3 tiers to a different provider family.
 */
export function getActiveModelProvider(): ModelProvider {
  return PROVIDERS[getActiveProvider()];
}

export async function executeModelCall(params: ModelCallParams): Promise<CallResult> {
  return getActiveModelProvider().executeCall(params);
}

export type { CallResult, ModelCallParams, ModelProvider } from './types';
