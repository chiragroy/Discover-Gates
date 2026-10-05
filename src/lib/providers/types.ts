import { Tier, Provider } from '@/config/pricing';

export interface CallResult {
  text: string;
  model: string;
  tier: Tier;
  provider: Provider;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costMicro: number;
  latencyMs: number;
  isMock?: boolean;
}

export interface ModelCallParams {
  messageId: string;
  tier: Tier;
  prompt: string;
  systemContext?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ModelProvider {
  id: Provider;
  label: string;
  executeCall(params: ModelCallParams): Promise<CallResult>;
}
