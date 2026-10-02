# Gatehouse — Pre-Flight Gate Chain for LLM Calls

> *The cheapest token is the one you never send, and the only honest cost metric is cost per accepted answer.*

**Gatehouse** is a pre-flight gate chain for LLM calls, wrapped in an AI assistant for professional-services users (lawyers, consultants, and accountants). It decides, **before any provider call is made**, whether the call should happen at all and which model should handle it.

---

## 1. The Core Architecture

Four gates run locally on CPU at zero external provider cost. Three can answer or stop the request without ever reaching a model. The right-hand ledger rail shows the user, in the vernacular of billing, what was decided, what was spent, and what was avoided.

```
                           User Query
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │ Gate 1: Policy (Regex + Clause Cosine)       │ ──► [ Blocked ] ($0)
        └──────────────────────┬───────────────────────┘
                               │ Allowed
                               ▼
        ┌──────────────────────────────────────────────┐
        │ Gate 2: Necessity (Deterministic / mathjs)   │ ──► [ Computed, not generated ] ($0)
        └──────────────────────┬───────────────────────┘
                               │ Needs Model
                               ▼
        ┌──────────────────────────────────────────────┐
        │ Gate 3: Recall (Semantic Cache Cosine ≥ 0.82)│ ──► [ Offer Prior Answer ] ($0)
        └──────────────────────┬───────────────────────┘
                               │ No Match / Ask Fresh
                               ▼
        ┌──────────────────────────────────────────────┐
        │ Gate 4: Routing (kNN k=5 on 161 Prompts)     │ ──► Selects Fast / Standard / Deep
        └──────────────────────┬───────────────────────┘
                               │
                               ▼
                Gemini Model Call (with Stable Prefix & History Truncation)
                               │
                               ▼
        Outcome Capture & Escalation Loop ("↳ This didn't answer my question")
```

---

## 2. The Hard Constraint

Every gate runs on local compute only: deterministic rules, regex, local embeddings (`all-MiniLM-L6-v2`), cosine similarity, and arithmetic (`mathjs`). **No provider call is permitted inside the gate chain.**

* **Zero-Token Decisions:** A cost-control layer that spends tokens to decide how to spend tokens has eaten its own margin.
* **Sub-Millisecond Execution:** Brute-force cosine in JS over SQLite BLOB vectors runs in $<2\text{ ms}$.
* **Accounting Precision:** All costs are stored as **integer micro-dollars** (`cost_micro` where $\$1.00 = 1{,}000{,}000\text{ micro-dollars}$) to avoid float drift.

---

## 3. The Four Pre-Flight Gates

| Gate | Type | Budget | Fail Mode | Functionality |
|---|---|---|---|---|
| **Gate 1: Policy** | Terminal | 40ms | `closed` | Sensitive data regex (PAN, Aadhaar, account numbers) + blocked keywords + clause cosine ($>0.55 \implies$ block, $>0.50 \implies$ conditional). |
| **Gate 2: Necessity** | Terminal | 20ms | `open` | Pure arithmetic, percentages, date math ("90 days from X"), and unit conversions via `mathjs`. Answer is labeled **Computed, not generated**. |
| **Gate 3: Recall** | Terminal | 60ms | `open` | Matter-scoped cosine match ($\ge 0.82$) over prior accepted answers. Returns an **offer** to reuse or ask fresh, never a silent injection. |
| **Gate 4: Routing** | Shaping | 30ms | `open` (`standard`) | 5-NN majority vote over 161 hand-labelled prompts across 3 tiers (Fast, Standard, Deep) with token length and drafting verb overrides. |

---

## 4. Tiers and Pricing Configuration

Pricing lives in `src/config/pricing.ts`:

| Tier | Gemini Model | Max Output | Input / Output per 1M Tokens |
|---|---|---|---|
| **Fast** | `gemini-3.5-flash-lite` | 1,024 | \$0.075 / \$0.30 |
| **Standard** | `gemini-3.8-flash` | 2,048 | \$0.15 / \$0.60 |
| **Deep** | `gemini-3.1-pro-preview` | 4,096 | \$1.25 / \$5.00 |

*Includes an offline simulated mock engine when `GEMINI_API_KEY` is not present, allowing full local demonstration without API keys.*

---

## 5. Walkthrough: The 5 Golden Paths

Use the 1-click **Demo Presets** in the composer bar:

1. **Math Query:** `"What's 18% of 2,450,000?"`  
   $\to$ **Gate 2 Necessity resolves.** Zero tokens, instant, labeled *Computed, not generated*.
2. **Short Summary:** `"Summarise this indemnity clause in plain English: [clause]"`  
   $\to$ **Gate 4 routes to Fast tier** (`gemini-3.5-flash-lite`).
3. **Strategic Drafting:** `"Draft our position on the counterparty's indemnity cap, referencing the clause above."`  
   $\to$ **Gate 4 routes to Deep tier** (`gemini-3.1-pro-preview`).
4. **Data Violation:** `"Here are the client's account details, 4521-8890-2211, advise on the transfer."`  
   $\to$ **Gate 1 Policy blocks.** Flags unmasked account number in $<1\text{ ms}$.
5. **Semantic Recall:** `"Can you put that indemnity clause into plain language?"`  
   $\to$ **Gate 3 Recall offers** the prior accepted answer from step 2 ($88.2\%$ match) with zero token consumption upon acceptance.
6. **Escalation Test:** Click `↳ This didn't answer my question` on Step 2. It escalates to Standard/Deep, logs retry cost, and recalculates **Cost per Accepted Answer** on the *This Month* tab.

---

## 6. Honest Limitations

* **No Multi-Tenant Auth:** Single-user session model scoped to local SQLite database.
* **Seed Classification Scope:** The routing classifier is trained on 161 hand-labelled legal/accounting prompts, not an external academic benchmark.
* **Deterministic Policy Band:** Ambiguous policy matches ($0.45\text{--}0.55$) apply a conservative conditional verdict rather than escalating to an external compliance model.
* **No Mid-Flight Streaming Aborts:** Decisions are made strictly pre-flight.

---

## 7. Development & Verification

```bash
# 1. Warm local embedding model
npm run warm

# 2. Seed database (policies, 161 labelled prompts, 31 historical Q&As across 3 matters)
npm run seed

# 3. Run the automated 5-gate test suite
npx tsx scripts/verify-gates.ts

# 4. Start local development server
npm run dev
```
