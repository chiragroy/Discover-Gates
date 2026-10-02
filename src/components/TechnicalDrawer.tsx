'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ChainExecutionSummary } from '@/types/gate';
import { CallResult } from '@/lib/gemini';

interface TechnicalDrawerProps {
  summary?: ChainExecutionSummary | null;
  call?: CallResult | null;
}

export function TechnicalDrawer({ summary, call }: TechnicalDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!summary && !call) return null;

  return (
    <div className="hairline-t pt-3 mt-4 text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[#575D65] hover:text-[#15181C] font-medium transition-colors w-full text-left py-1"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>Technical telemetry & routing weights</span>
      </button>

      {isOpen && (
        <div className="mt-2.5 space-y-3 pl-1 font-mono text-[11px] text-[#575D65]">
          {call && (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Model dispatch:</span>
                <span className="text-[#15181C] font-semibold">{call.model}</span>
              </div>
              <div className="flex justify-between">
                <span>Tokens (in / out / cached):</span>
                <span className="tabular-nums text-[#15181C]">
                  {call.inputTokens} / {call.outputTokens} / {call.cacheReadTokens}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Provider Latency:</span>
                <span className="tabular-nums text-[#15181C]">{call.latencyMs}ms</span>
              </div>
            </div>
          )}

          {summary && (
            <div className="space-y-1.5 hairline-t pt-2">
              <div className="text-[10px] uppercase tracking-wider text-[#575D65]">Pre-Flight Gate Telemetry</div>
              {summary.decisions.map(d => (
                <div key={d.gateId} className="flex justify-between items-center">
                  <span className="text-[#15181C]">{d.gateLabel}:</span>
                  <span className="tabular-nums">
                    {d.confidence !== undefined ? `conf ${(d.confidence * 100).toFixed(0)}% · ` : ''}
                    {d.latencyMs}ms
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-semibold hairline-t pt-1 text-[#15181C]">
                <span>Total Pre-Flight:</span>
                <span className="tabular-nums">{summary.totalGateLatencyMs}ms (budget 150ms)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
