import { Tier } from '@/config/pricing';

export type Verdict =
  | { kind: 'allow' }
  | { kind: 'allow_with_conditions'; conditions: string[] }
  | { kind: 'block'; userMessage: string }
  | { kind: 'resolve'; answer: string; method: string }
  | { kind: 'offer_recall'; priorMessageId: string; priorQuestion: string; similarity: number; priorAnswer: string; priorDate: string }
  | { kind: 'select_tier'; tier: Tier };

export interface GateResult {
  verdict: Verdict;
  reason: string; // Plain English, rendered directly in the UI for non-technical users
  confidence?: number;
  detail?: unknown; // Shown only in the technical drawer
  latencyMs?: number;
  costAvoidedMicro?: number;
}

export interface GateContext {
  db: unknown; // better-sqlite3 Database instance
  embed: (text: string) => Promise<Float32Array>;
}

export interface Envelope {
  id: string;
  conversationId: string;
  matterId: string;
  text: string;
  embedding?: Float32Array;
  tokens: {
    system: number;
    history: number;
    user: number;
  };
  turnIndex: number;
  spendSoFarMicro: number;
}

export interface Gate {
  id: string;
  label: string; // User-facing: "Policy", "Recall", "Necessity", "Routing"
  terminal: boolean; // May it end the request early?
  failMode: 'open' | 'closed';
  budgetMs: number;
  run(env: Envelope, ctx: GateContext): Promise<GateResult>;
}

export interface ChainExecutionSummary {
  envelope: Envelope;
  decisions: Array<{
    gateId: string;
    gateLabel: string;
    verdict: Verdict;
    reason: string;
    confidence?: number;
    detail?: unknown;
    latencyMs: number;
    costAvoidedMicro: number;
    bypassed?: boolean;
  }>;
  terminalVerdict?: Verdict;
  selectedTier: Tier;
  totalGateLatencyMs: number;
  totalCostAvoidedMicro: number;
}
