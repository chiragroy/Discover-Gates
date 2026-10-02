'use client';

import { useEffect, useState } from 'react';
import { formatMicroDollars } from '@/config/pricing';

interface MonthStats {
  mattersSpend: Array<{
    id: string;
    code: string;
    title: string;
    client_name: string;
    spend_micro: number;
    cap_micro: number;
  }>;
  totalSpendMicro: number;
  totalSpendFormatted: string;
  answeredWithoutModelCount: number;
  totalAvoidedMicro: number;
  totalAvoidedFormatted: string;
  reuseRate: number;
  costPerAcceptedMicro: number;
  costPerAcceptedFormatted: string;
  tierMix: {
    counts: { fast: number; standard: number; deep: number };
    totalCalls: number;
    percentages: { fast: number; standard: number; deep: number };
  };
}

export function ThisMonthTab({ refreshTrigger }: { refreshTrigger?: number }) {
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [refreshTrigger]);

  if (loading || !stats) {
    return (
      <div className="py-8 text-center text-xs text-[#575D65]">
        Loading monthly audit figures...
      </div>
    );
  }

  const { tierMix } = stats;

  return (
    <div className="space-y-6 text-xs text-[#15181C]">
      {/* 4 Clean Figures */}
      <div className="grid grid-cols-2 gap-4 pb-4 hairline-b">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#575D65] mb-1">Total Spend</div>
          <div className="text-xl font-semibold tabular-nums text-[#15181C]">
            {stats.totalSpendFormatted}
          </div>
          <div className="text-[11px] text-[#2F6B4F] mt-0.5 font-medium">
            {stats.totalAvoidedFormatted} avoided
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#575D65] mb-1">Cost / Accepted Answer</div>
          <div className="text-xl font-semibold tabular-nums text-[#15181C]">
            {stats.costPerAcceptedFormatted}
          </div>
          <div className="text-[11px] text-[#575D65] mt-0.5">
            quality-adjusted
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#575D65] mb-1">Answered Without Model</div>
          <div className="text-xl font-semibold tabular-nums text-[#2F6B4F]">
            {stats.answeredWithoutModelCount}
          </div>
          <div className="text-[11px] text-[#575D65] mt-0.5">
            zero token spend
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#575D65] mb-1">Answer Reuse Rate</div>
          <div className="text-xl font-semibold tabular-nums text-[#15181C]">
            {stats.reuseRate}%
          </div>
          <div className="text-[11px] text-[#575D65] mt-0.5">
            verified prior hits
          </div>
        </div>
      </div>

      {/* Tier Mix Horizontal Bar Row */}
      <div className="space-y-2 pb-4 hairline-b">
        <div className="flex justify-between items-center text-[11px]">
          <span className="font-semibold uppercase tracking-wider text-[#575D65] text-[10px]">Tier Dispatch Mix</span>
          <span className="tabular-nums text-[#575D65]">{tierMix.totalCalls} total calls</span>
        </div>

        {tierMix.totalCalls > 0 ? (
          <div className="space-y-1.5">
            <div className="h-2 w-full bg-[#E2E0DA] flex overflow-hidden rounded-xs">
              <div
                style={{ width: `${tierMix.percentages.fast}%` }}
                className="bg-[#2F6B4F] transition-all"
                title={`Fast: ${tierMix.percentages.fast}%`}
              />
              <div
                style={{ width: `${tierMix.percentages.standard}%` }}
                className="bg-[#575D65] transition-all"
                title={`Standard: ${tierMix.percentages.standard}%`}
              />
              <div
                style={{ width: `${tierMix.percentages.deep}%` }}
                className="bg-[#15181C] transition-all"
                title={`Deep: ${tierMix.percentages.deep}%`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#575D65]">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2F6B4F] inline-block" />
                Fast ({tierMix.percentages.fast}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#575D65] inline-block" />
                Standard ({tierMix.percentages.standard}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15181C] inline-block" />
                Deep ({tierMix.percentages.deep}%)
              </span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-[#575D65] italic">No provider calls recorded yet.</div>
        )}
      </div>

      {/* Spend By Matter */}
      <div className="space-y-2.5">
        <div className="text-[10px] uppercase tracking-wider text-[#575D65] font-semibold">Spend By Matter</div>
        <div className="space-y-2">
          {stats.mattersSpend.map(m => {
            const pct = Math.min(100, Math.round((m.spend_micro / m.cap_micro) * 100));
            return (
              <div key={m.id} className="p-2 border border-[#E2E0DA] bg-white rounded-xs">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-semibold text-[#15181C]">{m.code}</span>
                  <span className="tabular-nums font-medium text-[#15181C]">
                    {formatMicroDollars(m.spend_micro)}
                  </span>
                </div>
                <div className="text-[11px] text-[#575D65] truncate mb-1.5">{m.title}</div>
                <div className="w-full bg-[#ECEAE4] h-1 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full ${pct > 80 ? 'bg-[#8F2C27]' : 'bg-[#575D65]'}`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#575D65] mt-1">
                  <span>Cap: ${(m.cap_micro / 1_000_000).toFixed(0)}</span>
                  <span>{pct}% utilized</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
