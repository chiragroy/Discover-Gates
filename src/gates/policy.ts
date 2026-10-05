import { Gate, Envelope, GateResult, GateContext } from '@/types/gate';
import { bufferToFloat32Array, cosineSimilarity } from '@/lib/db';
import Database from 'better-sqlite3';

interface PolicyRuleRow {
  kind: string;
  pattern: string;
  message: string;
}

interface PolicyClauseRow {
  id: string;
  text: string;
  action: 'prohibit' | 'conditional' | 'permit';
  note: string | null;
  embedding: Buffer;
}

export const PolicyGate: Gate = {
  id: 'gate-policy',
  label: 'Policy',
  terminal: true,
  failMode: 'closed', // Gate 1 is the ONLY closed gate
  budgetMs: 40,

  async run(env: Envelope, ctx: GateContext): Promise<GateResult> {
    const db = ctx.db as Database.Database;
    const text = env.text;

    // 1. Sensitive-data regex & blocked rules (active policy only)
    const rules = db.prepare(`
      SELECT r.kind, r.pattern, r.message
      FROM policy_rules r
      JOIN policies p ON p.id = r.policy_id
      WHERE p.is_active = 1
    `).all() as PolicyRuleRow[];
    for (const rule of rules) {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(text)) {
          return {
            verdict: {
              kind: 'block',
              userMessage: `Request blocked: ${rule.message}`,
            },
            reason: `Detected restricted pattern: ${rule.message}`,
            confidence: 0.99,
            detail: {
              matchedKind: rule.kind,
              matchedPattern: rule.pattern,
              ruleMessage: rule.message,
            },
            costAvoidedMicro: 4500, // standard call cost avoided
          };
        }
      } catch {
        // Safe regex failure fallback
      }
    }

    // 2. Clause similarity check (active policy only)
    const clauses = db.prepare(`
      SELECT c.id, c.text, c.action, c.note, c.embedding
      FROM policy_clauses c
      JOIN policies p ON p.id = c.policy_id
      WHERE p.is_active = 1 AND c.embedding IS NOT NULL
    `).all() as PolicyClauseRow[];

    if (clauses.length > 0) {
      const userEmbedding = env.embedding || (await ctx.embed(text));
      env.embedding = userEmbedding;

      const scored = clauses.map(c => {
        const clauseVector = bufferToFloat32Array(c.embedding);
        const sim = cosineSimilarity(userEmbedding, clauseVector);
        return { clause: c, similarity: sim };
      });

      scored.sort((a, b) => b.similarity - a.similarity);
      const top = scored[0];

      // Prohibit above 0.55 -> block
      if (top.clause.action === 'prohibit' && top.similarity >= 0.55) {
        return {
          verdict: {
            kind: 'block',
            userMessage: `Policy violation: ${top.clause.note || top.clause.text}`,
          },
          reason: `Policy Block — matched clause prohibiting this request (${(top.similarity * 100).toFixed(0)}% match)`,
          confidence: top.similarity,
          detail: {
            clauseText: top.clause.text,
            similarity: top.similarity,
            action: top.clause.action,
          },
          costAvoidedMicro: 5000,
        };
      }

      // Conditional above 0.50 -> allow_with_conditions
      if (top.clause.action === 'conditional' && top.similarity >= 0.50) {
        return {
          verdict: {
            kind: 'allow_with_conditions',
            conditions: [top.clause.note || top.clause.text],
          },
          reason: `Permitted with conditions: "${top.clause.note || top.clause.text}"`,
          confidence: top.similarity,
          detail: {
            clauseText: top.clause.text,
            similarity: top.similarity,
            condition: top.clause.note || top.clause.text,
          },
        };
      }

      // Ambiguous band (0.45 - 0.55) -> allow_with_conditions (flagged for review)
      if (top.similarity >= 0.45 && top.similarity < 0.55) {
        return {
          verdict: {
            kind: 'allow_with_conditions',
            conditions: ['Flagged for compliance review: borderline policy similarity.'],
          },
          reason: `Allowed with condition — flagged for supervisor compliance review (${(top.similarity * 100).toFixed(0)}% borderline match)`,
          confidence: top.similarity,
          detail: {
            clauseText: top.clause.text,
            similarity: top.similarity,
          },
        };
      }
    }

    return {
      verdict: { kind: 'allow' },
      reason: 'Passed policy checks — no confidential patterns or restrictions found',
      confidence: 0.95,
      detail: { checkedRules: rules.length, checkedClauses: clauses.length },
    };
  },
};
