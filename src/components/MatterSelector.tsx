'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export interface Matter {
  id: string;
  code: string;
  client_name: string;
  title: string;
  cap_micro: number;
}

interface MatterSelectorProps {
  matters: Matter[];
  selectedMatterId: string;
  onSelectMatter: (matterId: string) => void;
}

export function MatterSelector({ matters, selectedMatterId, onSelectMatter }: MatterSelectorProps) {
  const current = matters.find(m => m.id === selectedMatterId) || matters[0];

  return (
    <div className="flex items-center justify-between px-6 py-3.5 hairline-b bg-[#FBFBF9] text-[#15181C]">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wider text-[#575D65] font-semibold">Matter</span>
        <div className="relative">
          <select
            value={selectedMatterId}
            onChange={e => onSelectMatter(e.target.value)}
            className="text-sm font-medium bg-transparent border-b border-[#E2E0DA] pb-0.5 focus:outline-none focus:border-[#15181C] cursor-pointer pr-5"
          >
            {matters.map(m => (
              <option key={m.id} value={m.id} className="bg-white text-[#15181C]">
                {m.code} — {m.client_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {current && (
          <div className="text-xs text-[#575D65] font-medium hidden sm:block">
            <span className="text-[#15181C]">{current.title}</span>
            <span className="mx-2 text-[#E2E0DA]">|</span>
            <span>Cap: ${(current.cap_micro / 1_000_000).toFixed(2)}</span>
          </div>
        )}
        <Link
          href="/policy"
          className="flex items-center gap-1.5 text-xs text-[#575D65] hover:text-[#15181C] transition-colors"
        >
          <ShieldCheck size={14} />
          <span>Policy</span>
        </Link>
      </div>
    </div>
  );
}
