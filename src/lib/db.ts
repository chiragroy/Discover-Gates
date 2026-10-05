import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data folder exists
const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'gatehouse.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency & synchronous speed
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS matters (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL,
    title TEXT NOT NULL,
    cap_micro INTEGER NOT NULL DEFAULT 50000000, -- $50.00 default cap
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    embedding BLOB,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_text TEXT NOT NULL,
    -- Exactly one policy is active at a time; uploading a new one deactivates the rest.
    -- Gate 1 (Policy) only reads rules/clauses belonging to the active policy.
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS policy_clauses (
    id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    action TEXT NOT NULL, -- 'prohibit' | 'conditional' | 'permit'
    note TEXT,
    embedding BLOB
  );

  CREATE TABLE IF NOT EXISTS policy_rules (
    id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, -- 'blocked_topic' | 'sensitive_pattern'
    pattern TEXT NOT NULL,
    message TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gate_decisions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    gate TEXT NOT NULL,
    verdict TEXT NOT NULL,
    reason TEXT NOT NULL,
    confidence REAL,
    detail_json TEXT,
    latency_ms REAL NOT NULL,
    cost_avoided_micro INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    model TEXT NOT NULL,
    tier TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'gemini', -- 'gemini' | 'claude' | 'openai'
    input_tokens INTEGER NOT NULL,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL,
    cost_micro INTEGER NOT NULL,
    latency_ms REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS outcomes (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    accepted INTEGER NOT NULL DEFAULT 1,
    escalated_to_tier TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS labelled_prompts (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    complexity TEXT NOT NULL, -- 'simple' | 'medium' | 'complex'
    embedding BLOB
  );
`);

/**
 * Helper to convert Float32Array to Buffer for SQLite BLOB storage
 */
export function float32ArrayToBuffer(arr: Float32Array): Buffer {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

/**
 * Helper to convert SQLite BLOB Buffer back to Float32Array
 */
export function bufferToFloat32Array(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / Float32Array.BYTES_PER_ELEMENT);
}

/**
 * Fast brute-force cosine similarity between two Float32Array vectors.
 * At < 5,000 vectors, this executes in sub-millisecond time.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default db;
