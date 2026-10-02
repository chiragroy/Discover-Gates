'use client';

import { useState, useEffect } from 'react';
import { ChainExecutionSummary, Verdict } from '@/types/gate';
import { CallResult } from '@/lib/gemini';
import { formatMicroDollars } from '@/config/pricing';
import { TechnicalDrawer } from '@/components/TechnicalDrawer';
import { ThisMonthTab } from '@/components/ThisMonthTab';
import { ShieldCheck, ShieldAlert, Cpu, Database, ArrowRight } from 'lucide-react';

interface LedgerRailProps {
  currentSummary?: ChainExecutionSummary | null;
  currentCall?: CallResult | null;
  statsRefreshKey?: number;
}

export function LedgerRail({ currentSummary, currentCall, statsRefreshKey }: LedgerRailProps) {
  const [activeTab, setActiveTab] = useState<'answer' | 'month'>('answer');
  const [displayedAvoided, setDisplayedAvoided] = useState(0);

  const avoidedTarget = currentSummary?.totalCostAvoidedMicro || 0;

  // Single motion requirement: when a gate terminates a request, avoided cost counts up once.
  useEffect(() => {
    if (avoidedTarget === 0) {
      setDisplayedAvoided(0);
      return;
    }
    const duration = 400; // ms
    const frames = 20;
    const step = avoidedTarget / frames;
    let current = 0;
    const interval = setInterval(() => {
      current += step;
      if (current >= avoidedTarget) {
        setDisplayedAvoided(avoidedTarget);
        clearInterval(interval);
      } else {
        setDisplayedAvoided(Math.round(current));
      }
    }, duration / frames);

    return () => clearInterval(interval);
  }, [avoidedTarget]);

  return (
    <aside className="w-full lg:w-[400px] xl:w-[420px] hairline-l bg-[#FBFBF9] flex flex-col h-full overflow-hidden shrink-0">
      {/* Rail Tabs */}
      <div className="flex hairline-b bg-white text-xs">
        <button
          onClick={() => setActiveTab('answer')}
          className={`flex-1 py-3 text-center font-medium border-b-2 transition-colors ${
            activeTab === 'answer'
              ? 'border-[#15181C] text-[#15181C] font-semibold'
              : 'border-transparent text-[#575D65] hover:text-[#15181C]'
          }`}
        >
          This Answer
        </button>
        <button
          onClick={() => setActiveTab('month')}
          className={`flex-1 py-3 text-center font-medium border-b-2 transition-colors ${
            activeTab === 'month'
              ? 'border-[#15181C] text-[#15181C] font-semibold'
              : 'border-transparent text-[#575D65] hover:text-[#15181C]'
          }`}
        >
          This Month
        </button>
      </div>

      {/* Rail Content Area */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'month' ? (
          <ThisMonthTab refreshTrigger={statsRefreshKey} />
        ) : (
          <div className="space-y-5 text-xs text-[#15181C]">
            {/* Header statement notice */}
            <div className="flex justify-between items-baseline pb-2 hairline-b">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#575D65]">
                Pre-Flight Ledger Trail
              </span>
              <span className="text-[11px] text-[#575D65] tabular-nums">
                {currentSummary ? `${currentSummary.totalGateLatencyMs}ms total` : 'Ready'}
              </span>
            </div>

            {/* Step-by-Step Numbered Gate Trail */}
            {currentSummary ? (
              <div className="space-y-3.5">
                {currentSummary.decisions.map((d, index) => {
                  const gateNumber = index + 1;
                  const isBlocked = d.verdict.kind === 'block';
                  const isResolved = d.verdict.kind === 'resolve';
                  const isRecall = d.verdict.kind === 'offer_recall';
                  const isTier = d.verdict.kind === 'select_tier';

                  let badgeColor = 'text-[#575D65] bg-[#ECEAE4]';
                  let badgeText = 'Allowed';

                  if (isBlocked) {
                    badgeColor = 'text-white bg-[#8F2C27] font-semibold';
                    badgeText = 'Blocked';
                  } else if (isResolved) {
                    badgeColor = 'text-white bg-[#2F6B4F] font-semibold';
                    badgeText = 'Resolved (Local)';
                  } else if (isRecall) {
                    badgeColor = 'text-[#9A6B18] bg-[#F7F2E7] font-semibold';
                    badgeText = 'Recall Offered';
                  } else if (d.verdict.kind === 'select_tier') {
                    badgeColor = 'text-[#15181C] bg-[#E2E0DA] font-semibold';
                    badgeText = `Tier: ${d.verdict.tier.toUpperCase()}`;
                  } else if (d.verdict.kind === 'allow_with_conditions') {
                    badgeColor = 'text-[#9A6B18] bg-[#F7F2E7] font-semibold';
                    badgeText = 'Conditional';
                  }

                  return (
                    <div key={d.gateId} className="space-y-1.5 pb-3 hairline-b last:border-b-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full border border-[#E2E0DA] flex items-center justify-center text-[10px] font-bold text-[#575D65]">
                            {gateNumber}
                          </span>
                          <span className="font-semibold text-sm text-[#15181C]">{d.gateLabel}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-xs uppercase tracking-wider ${badgeColor}`}>
                          {badgeText}
                        </span>
                      </div>

                      <p className="text-[#575D65] pl-6 text-[12px] leading-relaxed">
                        {d.reason}
                      </p>

                      <div className="pl-6 text-[10px] text-[#575D65] flex justify-between items-center">
                        <span className="tabular-nums">Latency: {d.latencyMs}ms</span>
                        {d.costAvoidedMicro > 0 && (
                          <span className="text-[#2F6B4F] font-medium tabular-nums">
                            Avoided: {formatMicroDollars(d.costAvoidedMicro)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-[#575D65] space-y-2">
                <p className="font-serif italic text-sm text-[#15181C]">No request active.</p>
                <p className="text-[11px] max-w-xs mx-auto">
                  Submit a prompt or select a demo case below to observe the four local gates evaluate in real-time.
                </p>
              </div>
            )}

            {/* Financial Ledger Section */}
            <div className="pt-2 space-y-2 hairline-t">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[#575D65]">
                Accounting Line Items
              </div>
              <div className="space-y-1.5 bg-white p-3 border border-[#E2E0DA] rounded-xs font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#575D65]">Provider Cost Incurred:</span>
                  <span className="tabular-nums font-semibold text-[#15181C]">
                    {currentCall ? formatMicroDollars(currentCall.costMicro) : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#2F6B4F] font-medium">Cost Avoided Locally:</span>
                  <span className="tabular-nums font-bold text-[#2F6B4F]">
                    {avoidedTarget > 0 ? formatMicroDollars(displayedAvoided) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Collapsible Technical Drawer */}
            <TechnicalDrawer summary={currentSummary} call={currentCall} />
          </div>
        )}
      </div>
    </aside>
  );
}
