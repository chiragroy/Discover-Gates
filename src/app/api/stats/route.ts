import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { formatMicroDollars } from '@/config/pricing';

export const runtime = 'nodejs';

interface TierMixRow {
  tier: string;
  count: number;
}

interface MatterSpendRow {
  id: string;
  code: string;
  title: string;
  client_name: string;
  spend_micro: number;
  cap_micro: number;
}

export async function GET() {
  try {
    // 1. Spend by matter
    const mattersSpend = db
      .prepare(`
        SELECT 
          m.id, 
          m.code, 
          m.title, 
          m.client_name, 
          m.cap_micro,
          COALESCE(SUM(c.cost_micro), 0) AS spend_micro
        FROM matters m
        LEFT JOIN conversations conv ON conv.matter_id = m.id
        LEFT JOIN messages msg ON msg.conversation_id = conv.id
        LEFT JOIN calls c ON c.message_id = msg.id
        GROUP BY m.id
        ORDER BY spend_micro DESC
      `)
      .all() as MatterSpendRow[];

    const totalSpendMicro = mattersSpend.reduce((acc, m) => acc + m.spend_micro, 0);

    // 2. Questions answered without the model
    // Resolved by Necessity + Blocked by Policy + Accepted by Recall
    const uncalledRow = db
      .prepare(`
        SELECT 
          COUNT(CASE WHEN verdict = 'resolve' THEN 1 END) AS necessity_resolved,
          COUNT(CASE WHEN verdict = 'block' THEN 1 END) AS policy_blocked,
          COUNT(CASE WHEN verdict = 'accept_recall' THEN 1 END) AS recall_reused,
          COALESCE(SUM(cost_avoided_micro), 0) AS total_avoided_micro
        FROM gate_decisions
      `)
      .get() as {
        necessity_resolved: number;
        policy_blocked: number;
        recall_reused: number;
        total_avoided_micro: number;
      };

    const answeredWithoutModelCount =
      (uncalledRow?.necessity_resolved || 0) +
      (uncalledRow?.policy_blocked || 0) +
      (uncalledRow?.recall_reused || 0);

    // 3. Total questions & Reuse rate
    const totalUserQuestionsRow = db
      .prepare(`SELECT COUNT(*) AS total FROM messages WHERE role = 'user'`)
      .get() as { total: number };
    const totalQuestions = totalUserQuestionsRow?.total || 1;
    const reuseRate = Math.round(((uncalledRow?.recall_reused || 0) / Math.max(1, totalQuestions)) * 100);

    // 4. Cost per accepted answer
    // Total spend / accepted answers
    const acceptedCountRow = db
      .prepare(`SELECT COUNT(*) AS accepted_count FROM outcomes WHERE accepted = 1`)
      .get() as { accepted_count: number };
    const totalAccepted = acceptedCountRow?.accepted_count || 1;

    const costPerAcceptedMicro = Math.round(totalSpendMicro / Math.max(1, totalAccepted));

    // 5. Tier mix breakdown (for horizontal bar row)
    const tierRows = db
      .prepare(`
        SELECT tier, COUNT(*) AS count 
        FROM calls 
        GROUP BY tier
      `)
      .all() as TierMixRow[];

    const tierMix: Record<string, number> = { fast: 0, standard: 0, deep: 0 };
    let totalCalls = 0;
    for (const r of tierRows) {
      tierMix[r.tier] = r.count;
      totalCalls += r.count;
    }

    return NextResponse.json({
      mattersSpend,
      totalSpendMicro,
      totalSpendFormatted: formatMicroDollars(totalSpendMicro),
      answeredWithoutModelCount,
      totalAvoidedMicro: uncalledRow?.total_avoided_micro || 0,
      totalAvoidedFormatted: formatMicroDollars(uncalledRow?.total_avoided_micro || 0),
      reuseRate,
      costPerAcceptedMicro,
      costPerAcceptedFormatted: formatMicroDollars(costPerAcceptedMicro),
      tierMix: {
        counts: tierMix,
        totalCalls,
        percentages: {
          fast: totalCalls > 0 ? Math.round((tierMix.fast / totalCalls) * 100) : 0,
          standard: totalCalls > 0 ? Math.round((tierMix.standard / totalCalls) * 100) : 0,
          deep: totalCalls > 0 ? Math.round((tierMix.deep / totalCalls) * 100) : 0,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
