import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const matters = db
      .prepare(`
        SELECT id, code, client_name, title, cap_micro, created_at
        FROM matters
        ORDER BY created_at ASC
      `)
      .all();

    const conversations = db
      .prepare(`
        SELECT id, matter_id, title, created_at
        FROM conversations
        ORDER BY created_at ASC
      `)
      .all();

    return NextResponse.json({ matters, conversations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
