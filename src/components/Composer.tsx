'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { formatMicroDollars } from '@/config/pricing';

interface ComposerProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export const DEMO_PRESETS = [
  {
    label: '1. Math Query',
    text: "What's 18% of 2,450,000?",
    expected: 'Gate 2 Necessity resolves ($0 tokens)',
  },
  {
    label: '2. Short Summary',
    text: "Summarise this indemnity clause in plain English: The Supplier agrees to hold harmless the Customer from any third-party patent infringement actions resulting from standard software integration.",
    expected: 'Gate 4 routes to Fast tier',
  },
  {
    label: '3. Strategic Position',
    text: "Draft our position on the counterparty's indemnity cap, referencing the clause above.",
    expected: 'Gate 4 routes to Deep tier',
  },
  {
    label: '4. Sensitive Data',
    text: "Here are the client's account details, 4521-8890-2211, advise on the transfer.",
    expected: 'Gate 1 Policy blocks unmasked bank account',
  },
  {
    label: '5. Semantic Recall',
    text: "Can you put that indemnity clause into plain language?",
    expected: 'Gate 3 Recall offers 88% prior match',
  },
];

export function Composer({ onSendMessage, disabled }: ComposerProps) {
  const [input, setInput] = useState('');
  const [preflight, setPreflight] = useState<{
    policyStatus: 'allowed' | 'blocked' | 'conditional';
    policyNote: string;
    estimatedCostMicro: number;
    predictedTier: string;
  }>({
    policyStatus: 'allowed',
    policyNote: 'Ready',
    estimatedCostMicro: 0,
    predictedTier: 'fast',
  });

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Live pre-flight check on typing
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!input.trim()) {
      setPreflight({
        policyStatus: 'allowed',
        policyNote: 'Ready',
        estimatedCostMicro: 0,
        predictedTier: 'fast',
      });
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: input }),
        });
        if (res.ok) {
          const data = await res.json();
          setPreflight(data);
        }
      } catch (err) {
        console.error('Preflight check failed:', err);
      }
    }, 120);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || disabled) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isBlocked = preflight.policyStatus === 'blocked';

  return (
    <div className="hairline-t bg-white p-4 space-y-3 shrink-0">
      {/* 1-Click Demo Presets */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] text-[#575D65]">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-[#575D65] shrink-0 mr-1">
          Demo Presets:
        </span>
        {DEMO_PRESETS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setInput(p.text)}
            className="px-2 py-1 bg-[#FBFBF9] hover:bg-[#ECEAE4] border border-[#E2E0DA] rounded-xs shrink-0 cursor-pointer transition-colors"
            title={`${p.expected} — click to populate`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Textarea */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Gatehouse a question, request drafting, or enter figures to compute..."
          rows={2}
          disabled={disabled}
          className="w-full resize-none p-3 border border-[#E2E0DA] rounded-xs text-sm font-reading focus:outline-none focus:border-[#15181C] bg-[#FBFBF9] placeholder:text-[#575D65] text-[#15181C]"
        />

        {/* Composer Affordance Bar */}
        <div className="flex items-center justify-between text-xs pt-1">
          {/* Live Policy & Cost Affordance */}
          <div className="flex items-center gap-3">
            {/* Live Policy Indicator */}
            <div className="flex items-center gap-1.5">
              {isBlocked ? (
                <span className="flex items-center gap-1 text-[#8F2C27] font-semibold text-[11px]">
                  <ShieldAlert size={14} />
                  <span>{preflight.policyNote}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[#2F6B4F] font-medium text-[11px]">
                  <ShieldCheck size={14} />
                  <span>⚖️ Policy: Allowed</span>
                </span>
              )}
            </div>

            <span className="text-[#E2E0DA]">|</span>

            {/* Estimated Marginal Cost */}
            <div className="text-[11px] text-[#575D65] font-mono">
              <span>Est. marginal cost: </span>
              <span className="font-semibold text-[#15181C] tabular-nums">
                {input.trim() ? `~${formatMicroDollars(preflight.estimatedCostMicro)}` : '—'}
              </span>
              <span className="text-[10px] text-[#575D65] ml-1">({preflight.predictedTier} tier)</span>
            </div>
          </div>

          {/* Ask Button */}
          <button
            type="submit"
            disabled={!input.trim() || disabled}
            className={`px-4 py-2 rounded-xs font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              isBlocked
                ? 'bg-[#8F2C27] hover:bg-[#74231E] text-white'
                : 'bg-[#15181C] hover:bg-[#2C3138] text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <span>{isBlocked ? 'Submit (Will Block)' : 'Ask'}</span>
            <Send size={13} />
          </button>
        </div>
      </form>
    </div>
  );
}
