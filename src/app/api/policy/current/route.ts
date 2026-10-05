import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const runtime = 'nodejs';

interface PolicyRow {
  id: string;
  name: string;
  source_text: string;
  created_at: string;
}

interface RuleRow {
  id: string;
  kind: string;
  pattern: string;
  message: string;
}

interface ClauseRow {
  id: string;
  text: string;
  action: 'prohibit' | 'conditional' | 'permit';
  note: string | null;
}

export async function GET() {
  try {
    const policy = db
      .prepare(`SELECT id, name, source_text, created_at FROM policies WHERE is_active = 1 LIMIT 1`)
      .get() as PolicyRow | undefined;

    if (!policy) {
      return NextResponse.json({ policy: null, rules: [], clauses: [] });
    }

    const rules = db
      .prepare(`SELECT id, kind, pattern, message FROM policy_rules WHERE policy_id = ?`)
      .all(policy.id) as RuleRow[];

    const clauses = db
      .prepare(`SELECT id, text, action, note FROM policy_clauses WHERE policy_id = ?`)
      .all(policy.id) as ClauseRow[];

    return NextResponse.json({ policy, rules, clauses });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
