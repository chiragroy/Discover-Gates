export type Tier = 'fast' | 'standard' | 'deep';
export type Provider = 'gemini' | 'claude' | 'openai';

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

export const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
  openai: 'OpenAI',
};

// Model IDs and rates below are illustrative placeholders consistent with this repo's
// forward-looking demo convention (see gemini tier). Verify/update against your actual
// provider account before relying on real pricing or model availability.
export const PROVIDER_TIER_CONFIGS: Record<Provider, Record<Tier, TierConfig>> = {
  gemini: {
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
  },
  claude: {
    fast: {
      name: 'fast',
      model: 'claude-haiku-4-5',
      displayName: 'Fast (Claude Haiku 4.5)',
      maxOutputTokens: 1024,
      inputPerMillionMicro: 80_000, // $0.08 / M
      outputPerMillionMicro: 400_000, // $0.40 / M
      cacheReadPerMillionMicro: 8_000,
      typicalOutputTokens: 320,
    },
    standard: {
      name: 'standard',
      model: 'claude-sonnet-5-5',
      displayName: 'Standard (Claude Sonnet 5.5)',
      maxOutputTokens: 2048,
      inputPerMillionMicro: 300_000, // $0.30 / M
      outputPerMillionMicro: 1_500_000, // $1.50 / M
      cacheReadPerMillionMicro: 30_000,
      typicalOutputTokens: 580,
    },
    deep: {
      name: 'deep',
      model: 'claude-opus-5-5',
      displayName: 'Deep (Claude Opus 5.5)',
      maxOutputTokens: 4096,
      inputPerMillionMicro: 1_500_000, // $1.50 / M
      outputPerMillionMicro: 7_500_000, // $7.50 / M
      cacheReadPerMillionMicro: 150_000,
      typicalOutputTokens: 1200,
    },
  },
  openai: {
    fast: {
      name: 'fast',
      model: 'gpt-5-mini',
      displayName: 'Fast (GPT-5 Mini)',
      maxOutputTokens: 1024,
      inputPerMillionMicro: 250_000, // $0.25 / M
      outputPerMillionMicro: 2_000_000, // $2.00 / M
      cacheReadPerMillionMicro: 25_000,
      typicalOutputTokens: 320,
    },
    standard: {
      name: 'standard',
      model: 'gpt-5',
      displayName: 'Standard (GPT-5)',
      maxOutputTokens: 2048,
      inputPerMillionMicro: 1_250_000, // $1.25 / M
      outputPerMillionMicro: 10_000_000, // $10.00 / M
      cacheReadPerMillionMicro: 125_000,
      typicalOutputTokens: 580,
    },
    deep: {
      name: 'deep',
      model: 'gpt-5-pro',
      displayName: 'Deep (GPT-5 Pro)',
      maxOutputTokens: 4096,
      inputPerMillionMicro: 15_000_000, // $15.00 / M
      outputPerMillionMicro: 120_000_000, // $120.00 / M
      cacheReadPerMillionMicro: 1_500_000,
      typicalOutputTokens: 1200,
    },
  },
};

/**
 * Reads MODEL_PROVIDER from the environment, defaulting to Gemini.
 * This is the single switch that moves all 3 tiers to a different provider family.
 */
export function getActiveProvider(): Provider {
  const raw = (process.env.MODEL_PROVIDER || '').toLowerCase();
  if (raw === 'claude' || raw === 'openai' || raw === 'gemini') return raw;
  return 'gemini';
}

export function getTierConfig(tier: Tier, provider: Provider = getActiveProvider()): TierConfig {
  return PROVIDER_TIER_CONFIGS[provider][tier];
}

/**
 * Calculates total cost in integer micro-dollars ($1.00 = 1,000,000 micro-dollars).
 * Never uses floating-point arithmetic for balances.
 */
export function calculateCostMicro(
  tier: Tier,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  provider: Provider = getActiveProvider()
): number {
  const config = getTierConfig(tier, provider);
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
export function estimateCostMicro(tier: Tier, inputTokens: number, provider: Provider = getActiveProvider()): number {
  const config = getTierConfig(tier, provider);
  return calculateCostMicro(tier, inputTokens, config.typicalOutputTokens, 0, provider);
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
