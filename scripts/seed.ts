import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db, { float32ArrayToBuffer } from '../src/lib/db';
import { computeEmbedding } from '../src/lib/embeddings';

async function seed() {
  console.log('=== STARTING GATEHOUSE DATABASE SEEDING ===');
  const start = performance.now();

  // Clear existing seed data safely
  db.exec(`
    DELETE FROM policy_rules;
    DELETE FROM policy_clauses;
    DELETE FROM policies;
    DELETE FROM labelled_prompts;
    DELETE FROM outcomes;
    DELETE FROM calls;
    DELETE FROM gate_decisions;
    DELETE FROM messages;
    DELETE FROM conversations;
    DELETE FROM matters;
  `);

  console.log('Cleared existing tables.');

  // 1. Seed Policies and Rules
  console.log('\n--- 1. Seeding Policies and Rules ---');
  const policyFile = path.join(process.cwd(), 'seed', 'policies.json');
  const policyData = JSON.parse(fs.readFileSync(policyFile, 'utf-8'));

  const policyId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO policies (id, name, source_text)
    VALUES (?, ?, ?)
  `).run(policyId, policyData.name, policyData.source_text);

  const insertRule = db.prepare(`
    INSERT INTO policy_rules (id, policy_id, kind, pattern, message)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const rule of policyData.rules) {
    insertRule.run(crypto.randomUUID(), policyId, rule.kind, rule.pattern, rule.message);
  }
  console.log(`Inserted ${policyData.rules.length} policy rules (sensitive patterns & blocked topics).`);

  const insertClause = db.prepare(`
    INSERT INTO policy_clauses (id, policy_id, text, action, note, embedding)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const clause of policyData.clauses) {
    const emb = await computeEmbedding(clause.text);
    insertClause.run(
      crypto.randomUUID(),
      policyId,
      clause.text,
      clause.action,
      clause.note,
      float32ArrayToBuffer(emb)
    );
  }
  console.log(`Inserted ${policyData.clauses.length} policy clauses with computed embeddings.`);

  // 2. Seed Labelled Prompts (for Gate 4 Routing kNN)
  console.log('\n--- 2. Seeding Labelled Prompts (kNN Seed) ---');
  const promptFile = path.join(process.cwd(), 'seed', 'labelled-prompts.json');
  const prompts = JSON.parse(fs.readFileSync(promptFile, 'utf-8'));

  const insertPrompt = db.prepare(`
    INSERT INTO labelled_prompts (id, text, complexity, embedding)
    VALUES (?, ?, ?, ?)
  `);

  console.log(`Computing embeddings for ${prompts.length} prompts...`);
  let promptCount = 0;
  for (const p of prompts) {
    const emb = await computeEmbedding(p.text);
    insertPrompt.run(p.id, p.text, p.complexity, float32ArrayToBuffer(emb));
    promptCount++;
    if (promptCount % 40 === 0) {
      console.log(`  Processed ${promptCount}/${prompts.length} prompt embeddings...`);
    }
  }
  console.log(`Successfully seeded ${prompts.length} labelled prompts into DB.`);

  // 3. Seed Matters and Accepted History (for Gate 3 Recall)
  console.log('\n--- 3. Seeding Matters & Historical Q&As ---');
  const historyFile = path.join(process.cwd(), 'seed', 'history.json');
  const matters = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));

  const insertMatter = db.prepare(`
    INSERT INTO matters (id, code, client_name, title, cap_micro)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertConv = db.prepare(`
    INSERT INTO conversations (id, matter_id, title)
    VALUES (?, ?, ?)
  `);

  const insertMsg = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, embedding, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertOutcome = db.prepare(`
    INSERT INTO outcomes (id, message_id, accepted, created_at)
    VALUES (?, ?, 1, ?)
  `);

  let totalQuestions = 0;

  for (const m of matters) {
    const matterId = crypto.randomUUID();
    insertMatter.run(matterId, m.matterCode, m.clientName, m.matterTitle, 50000000);

    for (const c of m.conversations) {
      const convId = crypto.randomUUID();
      insertConv.run(convId, matterId, c.title);

      let msgIndex = 1;
      for (const pair of c.messages) {
        const userMsgId = crypto.randomUUID();
        const asstMsgId = crypto.randomUUID();
        const timestamp = new Date(Date.now() - (100 - msgIndex) * 3600000).toISOString();

        // Compute embedding for user question so Recall gate can match
        const userEmb = await computeEmbedding(pair.content);

        insertMsg.run(userMsgId, convId, 'user', pair.content, float32ArrayToBuffer(userEmb), timestamp);
        insertMsg.run(asstMsgId, convId, 'assistant', pair.answer, null, timestamp);

        // Mark as accepted outcome
        insertOutcome.run(crypto.randomUUID(), userMsgId, timestamp);

        totalQuestions++;
        msgIndex++;
      }
    }
  }
  console.log(`Inserted ${matters.length} matters with ${totalQuestions} prior accepted Q&A pairs.`);

  const totalTime = ((performance.now() - start) / 1000).toFixed(1);
  console.log(`\n=== SEEDING COMPLETED IN ${totalTime}s ===`);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
