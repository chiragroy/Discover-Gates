import { Tier, Provider, calculateCostMicro } from '@/config/pricing';
import db from '@/lib/db';
import crypto from 'crypto';
import { CallResult } from './types';
import { generateProfessionalMockAnswer } from './mock';

/**
 * Persists a provider call into the shared `calls` ledger table.
 * Used identically by every provider adapter so cost accounting stays consistent.
 */
export function persistCall(params: {
  messageId: string;
  model: string;
  tier: Tier;
  provider: Provider;
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  costMicro: number;
  latencyMs: number;
}): void {
  const callId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO calls (id, message_id, model, tier, provider, input_tokens, cache_read_tokens, output_tokens, cost_micro, latency_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    callId,
    params.messageId,
    params.model,
    params.tier,
    params.provider,
    params.inputTokens,
    params.cacheReadTokens,
    params.outputTokens,
    params.costMicro,
    params.latencyMs
  );
}

/**
 * Builds and persists an offline mock result when a provider has no API key
 * configured, or its live call failed. Shared across all provider adapters.
 */
export function buildMockResult(params: {
  messageId: string;
  tier: Tier;
  provider: Provider;
  model: string;
  prompt: string;
  start: number;
}): CallResult {
  const { messageId, tier, provider, model, prompt, start } = params;
  const latencyMs = Math.round(performance.now() - start) + 120;
  const mockText = generateProfessionalMockAnswer(prompt, tier);
  const inputTokens = Math.ceil(prompt.length / 3.8);
  const outputTokens = Math.ceil(mockText.length / 3.8);
  const cacheReadTokens = 0;
  const costMicro = calculateCostMicro(tier, inputTokens, outputTokens, cacheReadTokens, provider);

  persistCall({ messageId, model, tier, provider, inputTokens, cacheReadTokens, outputTokens, costMicro, latencyMs });

  return {
    text: mockText,
    model,
    tier,
    provider,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    costMicro,
    latencyMs,
    isMock: true,
  };
}
