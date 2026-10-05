import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { executeModelCall } from '@/lib/providers';
import { Tier } from '@/config/pricing';
import crypto from 'crypto';

export const runtime = 'nodejs';

interface CallRow {
  tier: Tier;
  model: string;
  cost_micro: number;
}

interface MessageRow {
  conversation_id: string;
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userMessageId, conversationId } = await req.json();

    if (!userMessageId) {
      return NextResponse.json({ error: 'userMessageId is required' }, { status: 400 });
    }

    // 1. Fetch original call details and prompt
    const originalCall = db
      .prepare(`SELECT tier, model, cost_micro FROM calls WHERE message_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(userMessageId) as CallRow | undefined;

    const userMessage = db
      .prepare(`SELECT conversation_id, content FROM messages WHERE id = ?`)
      .get(userMessageId) as MessageRow | undefined;

    if (!userMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Determine target escalated tier: fast -> standard -> deep
    const currentTier = originalCall?.tier || 'fast';
    const nextTier: Tier = currentTier === 'fast' ? 'standard' : 'deep';

    // 2. Mark original outcome as NOT accepted and note escalation
    db.prepare(`
      UPDATE outcomes 
      SET accepted = 0, escalated_to_tier = ?
      WHERE message_id = ?
    `).run(nextTier, userMessageId);

    // 3. Re-run model at higher tier
    const escalationCall = await executeModelCall({
      messageId: userMessageId,
      tier: nextTier,
      prompt: userMessage.content,
      systemContext: `Escalated query re-run at elevated reasoning tier (${nextTier}) following user quality feedback.`,
    });

    // 4. Save new assistant message
    const asstMessageId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES (?, ?, 'assistant', ?)
    `).run(
      asstMessageId,
      conversationId || userMessage.conversation_id,
      `[Escalated to ${nextTier.toUpperCase()}]\n\n${escalationCall.text}`
    );

    // 5. Create new outcome record for the escalated answer (accepted by default)
    db.prepare(`
      INSERT INTO outcomes (id, message_id, accepted)
      VALUES (?, ?, 1)
    `).run(crypto.randomUUID(), userMessageId);

    const retryCostDeltaMicro = escalationCall.costMicro;

    return NextResponse.json({
      status: 'escalated',
      originalTier: currentTier,
      newTier: nextTier,
      text: escalationCall.text,
      asstMessageId,
      call: escalationCall,
      retryCostDeltaMicro,
      reason: `Escalated from ${currentTier} to ${nextTier} on user quality feedback`,
    });
  } catch (error: unknown) {
    console.error('Escalation API Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
