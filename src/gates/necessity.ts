import { Gate, Envelope, GateResult } from '@/types/gate';
import * as math from 'mathjs';

export const NecessityGate: Gate = {
  id: 'gate-necessity',
  label: 'Necessity',
  terminal: true,
  failMode: 'open', // Fails open to the model always
  budgetMs: 20,

  async run(env: Envelope): Promise<GateResult> {
    const raw = env.text.trim();
    const lower = raw.toLowerCase();

    // 1. Percentage calculation: e.g. "What's 18% of 2,450,000?" or "15% of 2.4 million"
    const pctMatch = lower.match(/(?:what(?:'s|\s+is)\s+)?([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:of)\s*([$€£₹]?\s*[0-9,]+(?:\.[0-9]+)?(?:\s*(?:million|m|k|billion|b))?)/i);
    if (pctMatch) {
      try {
        const pct = parseFloat(pctMatch[1]);
        let baseStr = pctMatch[2].replace(/[$€£₹,]/g, '').trim();
        let multiplier = 1;
        if (/million|m$/i.test(baseStr)) {
          multiplier = 1_000_000;
          baseStr = baseStr.replace(/million|m$/i, '').trim();
        } else if (/billion|b$/i.test(baseStr)) {
          multiplier = 1_000_000_000;
          baseStr = baseStr.replace(/billion|b$/i, '').trim();
        } else if (/k$/i.test(baseStr)) {
          multiplier = 1_000;
          baseStr = baseStr.replace(/k$/i, '').trim();
        }
        const base = parseFloat(baseStr) * multiplier;
        if (!isNaN(pct) && !isNaN(base)) {
          const result = (pct / 100) * base;
          const formattedResult = new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 2,
          }).format(result);
          const formattedBase = new Intl.NumberFormat('en-US').format(base);

          return {
            verdict: {
              kind: 'resolve',
              answer: `${pct}% of ${formattedBase} = **${formattedResult}**`,
              method: 'mathjs_percentage_engine',
            },
            reason: `Resolved locally — exact percentage calculated without calling model`,
            confidence: 1.0,
            detail: { parsedPercentage: pct, parsedBase: base, result },
            costAvoidedMicro: 2400,
          };
        }
      } catch {
        // Fall open to model
      }
    }

    // 2. Date arithmetic: e.g. "90 days from 14 November 2026", "30 days after October 1, 2026"
    const dateMathMatch = lower.match(/([0-9]+)\s*(days|weeks|months)\s*(?:from|after)\s*([a-zA-Z0-9,\s]+)/i);
    if (dateMathMatch) {
      try {
        const amount = parseInt(dateMathMatch[1], 10);
        const unit = dateMathMatch[2].toLowerCase();
        const targetDateStr = dateMathMatch[3].trim();
        const baseDate = new Date(targetDateStr);

        if (!isNaN(baseDate.getTime())) {
          const target = new Date(baseDate);
          if (unit.startsWith('day')) target.setDate(target.getDate() + amount);
          else if (unit.startsWith('week')) target.setDate(target.getDate() + amount * 7);
          else if (unit.startsWith('month')) target.setMonth(target.getMonth() + amount);

          const dateFormatted = target.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          return {
            verdict: {
              kind: 'resolve',
              answer: `${amount} ${unit} from ${baseDate.toDateString()} is **${dateFormatted}**`,
              method: 'calendar_arithmetic_engine',
            },
            reason: `Resolved locally — date arithmetic computed exactly`,
            confidence: 1.0,
            detail: { baseDate: baseDate.toISOString(), amount, unit, result: dateFormatted },
            costAvoidedMicro: 2100,
          };
        }
      } catch {
        // Fall open
      }
    }

    // 3. Clean math expression via mathjs: e.g. "calculate 2450000 * 0.18" or "125000 / 12"
    const mathClean = raw.replace(/^(?:what\s+is|calculate|evaluate|compute)\s+/i, '').replace(/[?]$/, '').trim();
    // Only accept strictly numeric math syntax to prevent code evaluation risks
    if (/^[0-9\s+\-*/^().,]+$/.test(mathClean) && /[+\-*/^]/.test(mathClean)) {
      try {
        const sanitized = mathClean.replace(/,/g, '');
        const evaluated = math.evaluate(sanitized);
        if (typeof evaluated === 'number' && !isNaN(evaluated)) {
          const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(evaluated);
          return {
            verdict: {
              kind: 'resolve',
              answer: `${mathClean} = **${formatted}**`,
              method: 'mathjs_evaluator',
            },
            reason: `Resolved locally — arithmetic evaluated cleanly via mathjs`,
            confidence: 1.0,
            detail: { expression: mathClean, result: evaluated },
            costAvoidedMicro: 2200,
          };
        }
      } catch {
        // Fall open
      }
    }

    // Needs a model
    return {
      verdict: { kind: 'allow' },
      reason: 'Question requires synthesis or qualitative analysis; cannot be resolved deterministically',
      confidence: 0.9,
      detail: { mathDetected: false },
    };
  },
};
