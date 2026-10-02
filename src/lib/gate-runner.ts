import { Gate, Envelope, ChainExecutionSummary, GateResult, Verdict } from '@/types/gate';
import { PolicyGate } from '@/gates/policy';
import { NecessityGate } from '@/gates/necessity';
import { RecallGate } from '@/gates/recall';
import { RoutingGate } from '@/gates/routing';
import { Tier } from '@/config/pricing';
import { computeEmbedding } from '@/lib/embeddings';
import db from '@/lib/db';
import crypto from 'crypto';

const CHAIN_GATES: Gate[] = [PolicyGate, NecessityGate, RecallGate, RoutingGate];

/**
 * Runs the pre-flight gate chain sequentially.
 * Enforces per-gate millisecond budgets, fail-open/fail-closed semantics,
 * and persists every gate decision into SQLite.
 */
export async function executeGateChain(envelope: Envelope): Promise<ChainExecutionSummary> {
  const chainStart = performance.now();
  let selectedTier: Tier = 'standard'; // Default tier
  let terminalVerdict: Verdict | undefined = undefined;
  let totalCostAvoided = 0;

  const decisions: ChainExecutionSummary['decisions'] = [];

  // Intake: Envelope built once at intake. Gates read it; no gate re-parses the request.
  if (!envelope.embedding) {
    envelope.embedding = await computeEmbedding(envelope.text);
  }

  const ctx = {
    db,
    embed: async (text: string) => {
      if (!envelope.embedding) {
        envelope.embedding = await computeEmbedding(text);
      }
      return envelope.embedding;
    },
  };

  for (const gate of CHAIN_GATES) {
    const gateStart = performance.now();
    let result: GateResult;
    let bypassed = false;

    try {
      // Per-gate timeout budget
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Budget exceeded (${gate.budgetMs}ms)`)), gate.budgetMs + 10)
      );

      result = await Promise.race([gate.run(envelope, ctx), timeoutPromise]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isTimeout = errorMessage.includes('Budget exceeded');
      bypassed = true;

      if (gate.failMode === 'closed') {
        result = {
          verdict: {
            kind: 'block',
            userMessage: `Request halted by ${gate.label} Gate (execution failure or budget timeout).`,
          },
          reason: `${gate.label} failed closed: ${errorMessage}`,
          confidence: 0,
          detail: { error: errorMessage, isTimeout },
        };
      } else {
        result = {
          verdict: { kind: 'allow' },
          reason: `${gate.label} bypassed due to ${isTimeout ? 'latency budget timeout' : 'error'}; failed open`,
          confidence: 0,
          detail: { error: errorMessage, isTimeout },
        };
      }
    }

    const latencyMs = parseFloat((performance.now() - gateStart).toFixed(2));
    const costAvoided = result.costAvoidedMicro || 0;
    totalCostAvoided += costAvoided;

    // Persist decision into DB
    const decisionId = crypto.randomUUID();
    const verdictKind = result.verdict.kind;

    try {
      db.prepare(`
        INSERT INTO gate_decisions (id, message_id, gate, verdict, reason, confidence, detail_json, latency_ms, cost_avoided_micro)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        decisionId,
        envelope.id,
        gate.label,
        verdictKind,
        result.reason,
        result.confidence ?? null,
        result.detail ? JSON.stringify(result.detail) : null,
        latencyMs,
        costAvoided
      );
    } catch (dbErr) {
      console.error(`Failed to persist gate decision for ${gate.label}:`, dbErr);
    }

    decisions.push({
      gateId: gate.id,
      gateLabel: gate.label,
      verdict: result.verdict,
      reason: result.reason,
      confidence: result.confidence,
      detail: result.detail,
      latencyMs,
      costAvoidedMicro: costAvoided,
      bypassed,
    });

    // Check shaping verdicts
    if (result.verdict.kind === 'select_tier') {
      selectedTier = result.verdict.tier;
    }

    // Check terminal verdicts
    if (gate.terminal && result.verdict.kind !== 'allow' && result.verdict.kind !== 'allow_with_conditions') {
      terminalVerdict = result.verdict;
      break; // Stop the chain immediately. Later gates do not run.
    }
  }

  const totalGateLatencyMs = parseFloat((performance.now() - chainStart).toFixed(2));

  return {
    envelope,
    decisions,
    terminalVerdict,
    selectedTier,
    totalGateLatencyMs,
    totalCostAvoidedMicro: totalCostAvoided,
  };
}
