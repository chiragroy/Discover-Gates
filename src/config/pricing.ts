export type Tier = 'fast' | 'standard' | 'deep';

export interface TierConfig {
  name: Tier;
  model: string;
  displayName: string;
  maxOutputTokens: number;
  // Rates in integer micro-dollars per 1,000,000 tokens ($1 = 1,000,000 micro-dollars)
  inputPerMillionMicro: number;
  outputPerMillionMicro: number;
  cacheReadPerMillionMicro: number;
  // Estimated average tokens for pre-flight estimation
  typicalOutputTokens: number;
}

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  fast: {
    name: 'fast',
    model: 'gemini-3.5-flash-lite',
    displayName: 'Fast (3.5 Flash-Lite)',
    maxOutputTokens: 1024,
    inputPerMillionMicro: 75_000, // $0.075 / M
    outputPerMillionMicro: 300_000, // $0.30 / M
    cacheReadPerMillionMicro: 18_750,
    typicalOutputTokens: 320,
  },
  standard: {
    name: 'standard',
    model: 'gemini-3.8-flash',
    displayName: 'Standard (3.8 Flash)',
    maxOutputTokens: 2048,
    inputPerMillionMicro: 150_000, // $0.15 / M
    outputPerMillionMicro: 600_000, // $0.60 / M
    cacheReadPerMillionMicro: 37_500,
    typicalOutputTokens: 580,
  },
  deep: {
    name: 'deep',
    model: 'gemini-3.1-pro-preview',
    displayName: 'Deep (3.1 Pro)',
    maxOutputTokens: 4096,
    inputPerMillionMicro: 1_250_000, // $1.25 / M
    outputPerMillionMicro: 5_000_000, // $5.00 / M
    cacheReadPerMillionMicro: 312_500,
    typicalOutputTokens: 1200,
  },
};

/**
 * Calculates total cost in integer micro-dollars ($1.00 = 1,000,000 micro-dollars).
 * Never uses floating-point arithmetic for balances.
 */
export function calculateCostMicro(
  tier: Tier,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0
): number {
  const config = TIER_CONFIGS[tier];
  const inputCost = BigInt(inputTokens) * BigInt(config.inputPerMillionMicro);
  const outputCost = BigInt(outputTokens) * BigInt(config.outputPerMillionMicro);
  const cacheCost = BigInt(cacheReadTokens) * BigInt(config.cacheReadPerMillionMicro);

  // Divide by 1,000,000 with integer rounding
  const total = (inputCost + outputCost + cacheCost + BigInt(500_000)) / BigInt(1_000_000);
  return Number(total);
}

/**
 * Estimates cost before the call has been made based on input length and tier average.
 */
export function estimateCostMicro(tier: Tier, inputTokens: number): number {
  const config = TIER_CONFIGS[tier];
  return calculateCostMicro(tier, inputTokens, config.typicalOutputTokens, 0);
}

/**
 * Formats integer micro-dollars into readable currency (e.g., "$0.0041").
 */
export function formatMicroDollars(microDollars: number): string {
  const dollars = microDollars / 1_000_000;
  if (microDollars === 0) return '$0.0000';
  if (microDollars < 1000) return `<$0.001`;
  return `$${dollars.toFixed(4)}`;
}
