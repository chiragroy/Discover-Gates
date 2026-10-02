import { Gate, Envelope, GateResult, GateContext } from '@/types/gate';
import { Tier } from '@/config/pricing';
import { bufferToFloat32Array, cosineSimilarity } from '@/lib/db';
import Database from 'better-sqlite3';

interface LabelledPromptRow {
  id: string;
  text: string;
  complexity: 'simple' | 'medium' | 'complex';
  embedding: Buffer;
}

const COMPLEX_OVERRIDE_REGEX =
  /\b(draft\s+(?:our\s+)?position|negotiat(?:e|ion)\s+strategy|statutory\s+interpretation|cross-border\s+tax\s+structur|merger\s+defense|appellate\s+brief|fiduciary\s+duty\s+analysis|antitrust\s+risk|reorganization\s+plan)\b/i;

const FAST_OVERRIDE_REGEX =
  /^(?:summarise|summarize|proofread|format|rephrase|bulletize|clean\s+up|extract\s+dates|proof)\b/i;

export const RoutingGate: Gate = {
  id: 'gate-routing',
  label: 'Routing',
  terminal: false, // Shaping gate, not terminal
  failMode: 'open', // Fails open to standard tier
  budgetMs: 30,

  async run(env: Envelope, ctx: GateContext): Promise<GateResult> {
    const text = env.text;
    const estInputTokens = env.tokens.user || Math.ceil(text.length / 4);

    // Hard Override 1: Explicit high-complexity drafting / analysis verbs -> deep tier
    if (COMPLEX_OVERRIDE_REGEX.test(text)) {
      return {
        verdict: { kind: 'select_tier', tier: 'deep' },
        reason: 'Selected Deep tier (High reasoning) — detected complex strategic legal/tax drafting verbs',
        confidence: 0.98,
        detail: { override: 'complex_verb_rule', estimatedTokens: estInputTokens },
      };
    }

    // Hard Override 2: Short summarization or formatting under 350 tokens -> fast tier
    if (FAST_OVERRIDE_REGEX.test(text) && estInputTokens < 350) {
      return {
        verdict: { kind: 'select_tier', tier: 'fast' },
        reason: 'Selected Fast tier (Low cost) — concise summarization / formatting task under 350 tokens',
        confidence: 0.95,
        detail: { override: 'fast_summary_rule', estimatedTokens: estInputTokens },
      };
    }

    const db = ctx.db as Database.Database;
    const labelled = db
      .prepare(`SELECT id, text, complexity, embedding FROM labelled_prompts WHERE embedding IS NOT NULL`)
      .all() as LabelledPromptRow[];

    // Fall open to standard if no training data
    if (labelled.length === 0) {
      const tier: Tier = estInputTokens > 1500 ? 'standard' : 'fast';
      return {
        verdict: { kind: 'select_tier', tier },
        reason: `Selected ${tier === 'fast' ? 'Fast' : 'Standard'} tier (default fallback without labelled seed)`,
        confidence: 0.7,
      };
    }

    const userEmbedding = env.embedding || (await ctx.embed(text));
    env.embedding = userEmbedding;

    // Compute similarity to all labelled prompts
    const scored = labelled.map(item => {
      const vec = bufferToFloat32Array(item.embedding);
      const sim = cosineSimilarity(userEmbedding, vec);
      return { ...item, sim };
    });

    // Top k = 5
    scored.sort((a, b) => b.sim - a.sim);
    const top5 = scored.slice(0, 5);

    // Count votes
    const votes: Record<'simple' | 'medium' | 'complex', number> = {
      simple: 0,
      medium: 0,
      complex: 0,
    };

    for (const match of top5) {
      votes[match.complexity]++;
    }

    // Determine winner with upward tie-breaking: simple < medium < complex
    let winner: 'simple' | 'medium' | 'complex' = 'simple';
    if (votes.medium >= votes.simple && votes.medium >= votes.complex) {
      winner = 'medium';
    } else if (votes.complex >= votes.simple && votes.complex >= votes.medium) {
      winner = 'complex';
    } else if (votes.simple > votes.medium && votes.simple > votes.complex) {
      winner = 'simple';
    }

    // Hard Override 2: Long context (> 1500 tokens) cannot be 'fast'
    if (estInputTokens > 1500 && winner === 'simple') {
      winner = 'medium';
    }

    const complexityToTier: Record<'simple' | 'medium' | 'complex', Tier> = {
      simple: 'fast',
      medium: 'standard',
      complex: 'deep',
    };

    const selectedTier = complexityToTier[winner];
    const topMatch = top5[0];
    const winVotes = votes[winner];
    const confidence = parseFloat((winVotes / 5).toFixed(2));

    const tierDescriptions: Record<Tier, string> = {
      fast: 'Fast — straightforward synthesis/formatting task identified via 5-NN consensus',
      standard: 'Standard — moderate legal/accounting analytical requirement identified',
      deep: 'Deep — intricate statutory reasoning or complex memorandum identified',
    };

    return {
      verdict: { kind: 'select_tier', tier: selectedTier },
      reason: tierDescriptions[selectedTier],
      confidence,
      detail: {
        winnerComplexity: winner,
        voteCounts: votes,
        nearestNeighborText: topMatch.text,
        nearestNeighborSimilarity: topMatch.sim,
        top5Neighbors: top5.map(n => ({ text: n.text, complexity: n.complexity, sim: n.sim })),
      },
    };
  },
};
