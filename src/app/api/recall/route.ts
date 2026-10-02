import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { userMessageId, conversationId, priorAnswer, similarity } = await req.json();

    if (!userMessageId || !conversationId || !priorAnswer) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Save prior answer as assistant response
    const asstMessageId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES (?, ?, 'assistant', ?)
    `).run(asstMessageId, conversationId, priorAnswer);

    // Record accepted outcome
    db.prepare(`
      INSERT INTO outcomes (id, message_id, accepted)
      VALUES (?, ?, 1)
    `).run(crypto.randomUUID(), userMessageId);

    // Record recall decision in gate_decisions with avoided cost
    const decisionId = crypto.randomUUID();
    const avoidedMicro = 3800; // Average call cost avoided
    db.prepare(`
      INSERT INTO gate_decisions (id, message_id, gate, verdict, reason, confidence, detail_json, latency_ms, cost_avoided_micro)
      VALUES (?, ?, 'Recall', 'accept_recall', ?, ?, ?, 0.5, ?)
    `).run(
      decisionId,
      userMessageId,
      'User accepted recalled answer — 100% token cost avoided',
      similarity || 0.85,
      JSON.stringify({ acceptedAt: new Date().toISOString(), priorAnswerLength: priorAnswer.length }),
      avoidedMicro
    );

    return NextResponse.json({
      status: 'recall_accepted',
      asstMessageId,
      text: priorAnswer,
      costAvoidedMicro: avoidedMicro,
      reason: 'Reused prior verified answer with zero token consumption',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
