import { NextRequest, NextResponse } from 'next/server';
import db, { float32ArrayToBuffer } from '@/lib/db';
import { computeEmbedding } from '@/lib/embeddings';
import crypto from 'crypto';

export const runtime = 'nodejs';

interface PublishRule {
  kind: string;
  pattern: string;
  message: string;
}

interface PublishClause {
  text: string;
  action: 'prohibit' | 'conditional' | 'permit';
  note?: string;
}

interface PublishBody {
  name: string;
  sourceText: string;
  rules: PublishRule[];
  clauses: PublishClause[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PublishBody;
    const { name, sourceText, rules, clauses } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Policy name is required.' }, { status: 400 });
    }
    if (!Array.isArray(rules) || !Array.isArray(clauses)) {
      return NextResponse.json({ error: 'rules and clauses must be arrays.' }, { status: 400 });
    }
    if (rules.length === 0 && clauses.length === 0) {
      return NextResponse.json({ error: 'At least one rule or clause is required to publish a policy.' }, { status: 400 });
    }

    // Reject the whole publish if any regex is invalid — an uncompilable pattern
    // would silently never match rather than error, defeating the point of the rule.
    for (const rule of rules) {
      try {
        new RegExp(rule.pattern, 'i');
      } catch {
        return NextResponse.json(
          { error: `Invalid regex pattern in rule "${rule.message}": ${rule.pattern}` },
          { status: 400 }
        );
      }
    }
    for (const rule of rules) {
      if (rule.kind !== 'blocked_topic' && rule.kind !== 'sensitive_pattern') {
        return NextResponse.json({ error: `Rule kind must be "blocked_topic" or "sensitive_pattern", got "${rule.kind}".` }, { status: 400 });
      }
    }
    for (const clause of clauses) {
      if (!['prohibit', 'conditional', 'permit'].includes(clause.action)) {
        return NextResponse.json({ error: `Clause action must be prohibit/conditional/permit, got "${clause.action}".` }, { status: 400 });
      }
    }

    // Compute clause embeddings before the transaction since it's async work;
    // better-sqlite3 transactions must run synchronously.
    const clauseEmbeddings = await Promise.all(clauses.map(c => computeEmbedding(c.text)));

    const policyId = crypto.randomUUID();

    const publish = db.transaction(() => {
      db.prepare(`UPDATE policies SET is_active = 0 WHERE is_active = 1`).run();

      db.prepare(`
        INSERT INTO policies (id, name, source_text, is_active)
        VALUES (?, ?, ?, 1)
      `).run(policyId, name.trim(), sourceText || '');

      const insertRule = db.prepare(`
        INSERT INTO policy_rules (id, policy_id, kind, pattern, message)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const rule of rules) {
        insertRule.run(crypto.randomUUID(), policyId, rule.kind, rule.pattern, rule.message);
      }

      const insertClause = db.prepare(`
        INSERT INTO policy_clauses (id, policy_id, text, action, note, embedding)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      clauses.forEach((clause, i) => {
        insertClause.run(
          crypto.randomUUID(),
          policyId,
          clause.text,
          clause.action,
          clause.note || null,
          float32ArrayToBuffer(clauseEmbeddings[i])
        );
      });
    });

    publish();

    return NextResponse.json({
      status: 'published',
      policyId,
      ruleCount: rules.length,
      clauseCount: clauses.length,
    });
  } catch (error: unknown) {
    console.error('Policy publish error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
