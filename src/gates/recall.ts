import { Gate, Envelope, GateResult, GateContext } from '@/types/gate';
import { bufferToFloat32Array, cosineSimilarity } from '@/lib/db';
import Database from 'better-sqlite3';

interface PriorCandidateRow {
  prior_message_id: string;
  prior_question: string;
  prior_embedding: Buffer;
  prior_date: string;
  prior_answer: string | null;
}

export const RecallGate: Gate = {
  id: 'gate-recall',
  label: 'Recall',
  terminal: true, // Terminal when user accepts, or offers recall option to UI
  failMode: 'open',
  budgetMs: 60,

  async run(env: Envelope, ctx: GateContext): Promise<GateResult> {
    const db = ctx.db as Database.Database;
    const text = env.text;

    // Get user embedding
    const userEmbedding = env.embedding || (await ctx.embed(text));
    env.embedding = userEmbedding;

    // Find prior user questions in the same matter that received an accepted answer
    const candidates = db
      .prepare(`
        SELECT 
          m.id AS prior_message_id,
          m.content AS prior_question,
          m.embedding AS prior_embedding,
          m.created_at AS prior_date,
          (
            SELECT ans.content 
            FROM messages ans 
            WHERE ans.conversation_id = m.conversation_id 
              AND ans.role = 'assistant' 
              AND ans.created_at >= m.created_at
            ORDER BY ans.created_at ASC 
            LIMIT 1
          ) AS prior_answer
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        LEFT JOIN outcomes o ON o.message_id = m.id
        WHERE c.matter_id = ?
          AND m.role = 'user'
          AND m.embedding IS NOT NULL
          AND m.id != ?
          AND (o.accepted IS NULL OR o.accepted = 1)
      `)
      .all(env.matterId, env.id) as PriorCandidateRow[];

    if (candidates.length === 0) {
      return {
        verdict: { kind: 'allow' },
        reason: 'No prior questions in this matter to match against',
        confidence: 0,
        detail: { candidatesSearched: 0 },
      };
    }

    let bestMatch: PriorCandidateRow | null = null;
    let highestSim = -1;

    for (const cand of candidates) {
      if (!cand.prior_embedding) continue;
      const candVector = bufferToFloat32Array(cand.prior_embedding);
      const sim = cosineSimilarity(userEmbedding, candVector);
      if (sim > highestSim) {
        highestSim = sim;
        bestMatch = cand;
      }
    }

    // Threshold 0.82
    if (bestMatch && highestSim >= 0.82 && bestMatch.prior_answer) {
      return {
        verdict: {
          kind: 'offer_recall',
          priorMessageId: bestMatch.prior_message_id,
          priorQuestion: bestMatch.prior_question,
          priorAnswer: bestMatch.prior_answer,
          priorDate: bestMatch.prior_date,
          similarity: highestSim,
        },
        reason: `Found prior accepted answer (${(highestSim * 100).toFixed(1)}% match) — offering user verification before token spend`,
        confidence: highestSim,
        detail: {
          matchedQuestion: bestMatch.prior_question,
          similarity: highestSim,
          date: bestMatch.prior_date,
        },
        costAvoidedMicro: 3800, // Cost avoided if user accepts recall
      };
    }

    return {
      verdict: { kind: 'allow' },
      reason: `No prior question in this matter met the 82% recall confidence threshold (closest: ${(Math.max(0, highestSim) * 100).toFixed(0)}%)`,
      confidence: highestSim > 0 ? highestSim : 0,
      detail: { candidatesSearched: candidates.length, topSimilarity: highestSim },
    };
  },
};
