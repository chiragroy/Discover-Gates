import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import crypto from 'crypto';
import { executeModelCall } from '@/lib/providers';

export const runtime = 'nodejs';

interface DraftRule {
  kind: 'blocked_topic' | 'sensitive_pattern';
  pattern: string;
  message: string;
}

interface DraftClause {
  text: string;
  action: 'prohibit' | 'conditional' | 'permit';
  note: string;
}

interface DraftPolicy {
  name: string;
  rules: DraftRule[];
  clauses: DraftClause[];
}

// Keeps the extraction prompt (and model cost) bounded for a single policy document.
const MAX_SOURCE_CHARS = 20_000;

function buildExtractionPrompt(sourceText: string): string {
  return `You are extracting structured rules from a company's AI usage / data-privacy policy document so it can drive an automated pre-flight compliance gate in front of an LLM chat assistant.

Return STRICT JSON only — no markdown code fences, no commentary before or after — matching exactly this shape:
{
  "name": string,
  "rules": [ { "kind": "blocked_topic" | "sensitive_pattern", "pattern": string, "message": string } ],
  "clauses": [ { "text": string, "action": "prohibit" | "conditional" | "permit", "note": string } ]
}

Guidance:
- "rules" capture things detectable by regex pattern matching against raw user text: specific sensitive identifiers (account numbers, national IDs, card numbers) and explicit prohibited keyword topics. "pattern" must be a valid JavaScript regular expression body (no slashes, no flags). Keep patterns conservative and specific to avoid over-blocking ordinary business language. These are drafts a human will review before anything goes live.
- "clauses" capture broader policy statements that need semantic/similarity matching against a user's request rather than exact pattern matching. Classify each as:
  - "prohibit": never allowed under any circumstance
  - "conditional": allowed only with a caveat — put the caveat in "note"
  - "permit": explicitly allowed (for contrast with the prohibited items)
- Only extract rules and clauses that are actually supported by the source text below. Do not invent policy content that isn't there.
- If the document is short or informal, extract what you reasonably can rather than returning empty arrays.

Source policy document text:
"""
${sourceText.slice(0, MAX_SOURCE_CHARS)}
"""`;
}

// The shared offline mock model returns generic legal prose, not JSON — so when no
// provider API key is configured, build an illustrative draft directly instead of
// trying to parse mock prose as structured output. Keeps the upload flow demonstrable
// with zero keys, consistent with the rest of the app's offline mode.
function buildMockDraft(sourceText: string): DraftPolicy {
  const firstLine = sourceText.split('\n').find(l => l.trim().length > 0)?.trim() || 'Uploaded Policy';
  return {
    name: `${firstLine.slice(0, 60)} (Mock Draft — no provider API key configured)`,
    rules: [
      {
        kind: 'sensitive_pattern',
        pattern: '\\b\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}\\b',
        message: 'Unmasked payment card or account number (illustrative mock rule)',
      },
    ],
    clauses: [
      {
        text: 'Transmitting unmasked client financial or identity details into LLM prompts is restricted.',
        action: 'prohibit',
        note: 'Illustrative mock clause — configure a provider API key to extract real clauses from this document.',
      },
    ],
  };
}

function parseDraftPolicy(raw: string): DraftPolicy {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Model did not return valid JSON for the policy draft.');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('rules' in parsed) ||
    !('clauses' in parsed) ||
    !Array.isArray((parsed as DraftPolicy).rules) ||
    !Array.isArray((parsed as DraftPolicy).clauses)
  ) {
    throw new Error('Model response is missing the expected rules/clauses arrays.');
  }

  const draft = parsed as DraftPolicy;
  return {
    name: typeof draft.name === 'string' && draft.name.trim() ? draft.name : 'Untitled Policy',
    rules: draft.rules,
    clauses: draft.clauses,
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A PDF file is required under the "file" field.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const sourceText = parsed.text.trim();

    if (!sourceText) {
      return NextResponse.json({ error: 'No extractable text found in this PDF.' }, { status: 400 });
    }

    const extractionCall = await executeModelCall({
      messageId: crypto.randomUUID(),
      tier: 'deep',
      prompt: buildExtractionPrompt(sourceText),
    });

    const draft = extractionCall.isMock ? buildMockDraft(sourceText) : parseDraftPolicy(extractionCall.text);

    return NextResponse.json({
      name: draft.name,
      sourceText: sourceText.slice(0, MAX_SOURCE_CHARS),
      sourceCharCount: sourceText.length,
      rules: draft.rules,
      clauses: draft.clauses,
      isMock: extractionCall.isMock,
    });
  } catch (error: unknown) {
    console.error('Policy extraction error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
