import { NextRequest, NextResponse } from 'next/server';
import db, { float32ArrayToBuffer } from '@/lib/db';
import { executeGateChain } from '@/lib/gate-runner';
import { executeModelCall } from '@/lib/providers';
import { Envelope } from '@/types/gate';
import crypto from 'crypto';

export const runtime = 'nodejs';

interface MatterRow {
  id: string;
  code: string;
  client_name: string;
  cap_micro: number;
}

interface MessageRow {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { matterId, conversationId, message, bypassRecall = false } = body;

    if (!matterId || !message?.trim()) {
      return NextResponse.json({ error: 'matterId and message are required' }, { status: 400 });
    }

    // 1. Fetch Matter and check budget cap
    const matter = db.prepare(`SELECT id, code, client_name, cap_micro FROM matters WHERE id = ?`).get(matterId) as MatterRow | undefined;
    if (!matter) {
      return NextResponse.json({ error: 'Matter not found' }, { status: 404 });
    }

    // Calculate spend so far in this matter
    const spendRow = db
      .prepare(`
        SELECT COALESCE(SUM(c.cost_micro), 0) AS total_spend
        FROM calls c
        JOIN messages m ON c.message_id = m.id
        JOIN conversations conv ON m.conversation_id = conv.id
        WHERE conv.matter_id = ?
      `)
      .get(matterId) as { total_spend: number };

    const spendSoFarMicro = spendRow?.total_spend || 0;

    // Check matter cap
    if (spendSoFarMicro >= matter.cap_micro) {
      return NextResponse.json({
        status: 'blocked',
        error: `Matter spend cap reached ($${(matter.cap_micro / 1_000_000).toFixed(2)}). New provider calls are halted.`,
        spendSoFarMicro,
        capMicro: matter.cap_micro,
      });
    }

    // 2. Resolve or create Conversation
    let activeConvId = conversationId;
    if (!activeConvId) {
      activeConvId = crypto.randomUUID();
      const title = message.slice(0, 48) + (message.length > 48 ? '...' : '');
      db.prepare(`INSERT INTO conversations (id, matter_id, title) VALUES (?, ?, ?)`).run(
        activeConvId,
        matterId,
        title
      );
    }

    // 3. Fetch recent conversation history (last 6 turns)
    const historyRows = db
      .prepare(`
        SELECT role, content 
        FROM messages 
        WHERE conversation_id = ? 
        ORDER BY created_at ASC 
        LIMIT 6
      `)
      .all(activeConvId) as MessageRow[];

    // 4. Save user message in messages table
    const userMessageId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES (?, ?, 'user', ?)
    `).run(userMessageId, activeConvId, message);

    // 5. Construct Envelope
    const envelope: Envelope = {
      id: userMessageId,
      conversationId: activeConvId,
      matterId,
      text: message,
      tokens: {
        system: 120,
        history: historyRows.reduce((acc, h) => acc + Math.ceil(h.content.length / 4), 0),
        user: Math.ceil(message.length / 4),
      },
      turnIndex: historyRows.length + 1,
      spendSoFarMicro,
    };

    // 6. Execute 4-gate pre-flight chain
    const summary = await executeGateChain(envelope);

    // Update message record with computed embedding so future recall hits work
    if (envelope.embedding) {
      db.prepare(`UPDATE messages SET embedding = ? WHERE id = ?`).run(
        float32ArrayToBuffer(envelope.embedding),
        userMessageId
      );
    }

    // 7. Handle Terminal Verdicts
    if (summary.terminalVerdict) {
      const v = summary.terminalVerdict;

      // Policy Block
      if (v.kind === 'block') {
        const asstMessageId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO messages (id, conversation_id, role, content)
          VALUES (?, ?, 'assistant', ?)
        `).run(asstMessageId, activeConvId, `⛔ ${v.userMessage}`);

        return NextResponse.json({
          status: 'blocked',
          conversationId: activeConvId,
          userMessageId,
          asstMessageId,
          text: `⛔ ${v.userMessage}`,
          decisions: summary.decisions,
          totalGateLatencyMs: summary.totalGateLatencyMs,
          totalCostAvoidedMicro: summary.totalCostAvoidedMicro,
          selectedTier: summary.selectedTier,
        });
      }

      // Necessity Resolve (Computed, not generated)
      if (v.kind === 'resolve') {
        const asstMessageId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO messages (id, conversation_id, role, content)
          VALUES (?, ?, 'assistant', ?)
        `).run(asstMessageId, activeConvId, v.answer);

        // Record accepted outcome for computed answers
        db.prepare(`
          INSERT INTO outcomes (id, message_id, accepted)
          VALUES (?, ?, 1)
        `).run(crypto.randomUUID(), userMessageId);

        return NextResponse.json({
          status: 'resolved',
          conversationId: activeConvId,
          userMessageId,
          asstMessageId,
          text: v.answer,
          isComputed: true,
          method: v.method,
          decisions: summary.decisions,
          totalGateLatencyMs: summary.totalGateLatencyMs,
          totalCostAvoidedMicro: summary.totalCostAvoidedMicro,
          selectedTier: summary.selectedTier,
        });
      }

      // Recall Offer (Unless user explicitly requested to bypass recall and ask fresh)
      if (v.kind === 'offer_recall' && !bypassRecall) {
        return NextResponse.json({
          status: 'recall_offered',
          conversationId: activeConvId,
          userMessageId,
          recallOffer: {
            priorMessageId: v.priorMessageId,
            priorQuestion: v.priorQuestion,
            priorAnswer: v.priorAnswer,
            priorDate: v.priorDate,
            similarity: v.similarity,
          },
          decisions: summary.decisions,
          totalGateLatencyMs: summary.totalGateLatencyMs,
          totalCostAvoidedMicro: summary.totalCostAvoidedMicro,
          selectedTier: summary.selectedTier,
        });
      }
    }

    // 8. Gate chain allowed -> Call LLM provider with selected tier
    const callResult = await executeModelCall({
      messageId: userMessageId,
      tier: summary.selectedTier,
      prompt: message,
      systemContext: `Matter Code: ${matter.code}, Client: ${matter.client_name}`,
      history: historyRows,
    });

    const asstMessageId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES (?, ?, 'assistant', ?)
    `).run(asstMessageId, activeConvId, callResult.text);

    // Initial outcome defaults to accepted (can be modified by escalation button)
    db.prepare(`
      INSERT INTO outcomes (id, message_id, accepted)
      VALUES (?, ?, 1)
    `).run(crypto.randomUUID(), userMessageId);

    return NextResponse.json({
      status: 'success',
      conversationId: activeConvId,
      userMessageId,
      asstMessageId,
      text: callResult.text,
      call: callResult,
      decisions: summary.decisions,
      totalGateLatencyMs: summary.totalGateLatencyMs,
      totalCostAvoidedMicro: summary.totalCostAvoidedMicro,
      selectedTier: summary.selectedTier,
    });
  } catch (error: unknown) {
    console.error('Chat API Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
