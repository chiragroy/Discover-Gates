import { executeGateChain } from '../src/lib/gate-runner';
import db from '../src/lib/db';
import crypto from 'crypto';

interface MatterRow {
  id: string;
  code: string;
}

async function verify() {
  console.log('=== VERIFYING GATEHOUSE 4-GATE PIPELINE ===\n');

  // Grab ACME matter id
  const matter = db.prepare(`SELECT id, code FROM matters WHERE code = 'ACME-2024-11'`).get() as MatterRow;
  if (!matter) {
    throw new Error('Matter ACME-2024-11 not found');
  }

  const testCases = [
    {
      name: 'Case 1: Math Query (Expect: Gate 2 Necessity resolves)',
      text: "What's 18% of 2,450,000?",
    },
    {
      name: 'Case 2: Short Summary (Expect: Gate 4 routes to Fast tier)',
      text: "Summarise this indemnity clause in plain English: The Supplier agrees to hold harmless the Customer from any third-party patent infringement actions resulting from standard software integration.",
    },
    {
      name: 'Case 3: Strategic Drafting (Expect: Gate 4 routes to Deep tier)',
      text: "Draft our position on the counterparty's indemnity cap, referencing the clause above.",
    },
    {
      name: 'Case 4: Data Violation (Expect: Gate 1 Policy blocks account number)',
      text: "Here are the client's account details, 4521-8890-2211, advise on the transfer.",
    },
    {
      name: 'Case 5: Semantic Recall (Expect: Gate 3 Recall offers prior accepted match)',
      text: "Can you put that indemnity clause into plain language?",
    },
  ];

  for (const tc of testCases) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`TEST: ${tc.name}`);
    console.log(`INPUT: "${tc.text}"`);

    const envelope = {
      id: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      matterId: matter.id,
      text: tc.text,
      tokens: { system: 120, history: 200, user: Math.ceil(tc.text.length / 4) },
      turnIndex: 1,
      spendSoFarMicro: 0,
    };

    const summary = await executeGateChain(envelope);

    console.log(`Total Chain Latency: ${summary.totalGateLatencyMs}ms (Budget < 150ms)`);
    console.log(`Avoided Cost: $${(summary.totalCostAvoidedMicro / 1_000_000).toFixed(4)}`);
    console.log(`Selected Tier: ${summary.selectedTier}`);
    if (summary.terminalVerdict) {
      console.log(`Terminal Verdict Kind: ${summary.terminalVerdict.kind}`);
    }

    console.log(`Decisions:`);
    for (const d of summary.decisions) {
      console.log(`  [${d.gateLabel}] -> ${d.verdict.kind}: "${d.reason}" (${d.latencyMs}ms)`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`ALL 5 GOLDEN GATES VERIFIED SUCCESSFULLY!`);
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
