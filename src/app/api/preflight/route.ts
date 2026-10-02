import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { estimateCostMicro } from '@/config/pricing';

export const runtime = 'nodejs';

interface PolicyRuleRow {
  kind: string;
  pattern: string;
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    const { text = '' } = await req.json();
    const raw = String(text).trim();

    if (!raw) {
      return NextResponse.json({
        policyStatus: 'allowed',
        policyNote: 'Ready',
        estimatedTokens: 0,
        estimatedCostMicro: 0,
        predictedTier: 'fast',
      });
    }

    // 1. Fast regex check for sensitive data & blocked topics
    const rules = db.prepare(`SELECT kind, pattern, message FROM policy_rules`).all() as PolicyRuleRow[];
    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(raw)) {
          return NextResponse.json({
            policyStatus: 'blocked',
            policyNote: `Blocked: ${rule.message}`,
            estimatedTokens: Math.ceil(raw.length / 4),
            estimatedCostMicro: 0,
            predictedTier: 'fast',
          });
        }
      } catch {
        // Safe regex continue
      }
    }

    // 2. Predict tier based on simple heuristics
    const estInputTokens = Math.ceil(raw.length / 4);
    let predictedTier: 'fast' | 'standard' | 'deep' = 'standard';

    if (
      /\b(draft\s+(?:our\s+)?position|negotiat(?:e|ion)\s+strategy|statutory\s+interpretation|cross-border\s+tax|appellate\s+brief)\b/i.test(
        raw
      )
    ) {
      predictedTier = 'deep';
    } else if (
      /^(?:summarise|summarize|proofread|format|rephrase|bulletize|clean\s+up|extract)\b/i.test(raw) &&
      estInputTokens < 350
    ) {
      predictedTier = 'fast';
    } else if (estInputTokens > 1500) {
      predictedTier = 'standard';
    }

    const estimatedCostMicro = estimateCostMicro(predictedTier, estInputTokens);

    return NextResponse.json({
      policyStatus: 'allowed',
      policyNote: 'Allowed',
      estimatedTokens: estInputTokens,
      estimatedCostMicro,
      predictedTier,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
