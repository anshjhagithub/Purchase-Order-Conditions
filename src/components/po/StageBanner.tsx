import React from 'react';
import { ChevronDown } from 'lucide-react';

const THEME = {
  cream: { bg: 'bg-cream-100', ring: '#e8a838', chip: 'bg-white/70' },
  mint: { bg: 'bg-mint-100', ring: '#2fae6c', chip: 'bg-white/70' },
  slate: { bg: 'bg-slate-100', ring: '#64748b', chip: 'bg-white/70' },
};

export function StageBanner({
  icon,
  title,
  stageIndex,
  totalStages = 7,
  ownerIcon,
  ownerLabel,
  ownerChip,
  actionIcon,
  actionText,
  percent,
  theme = 'cream',
  live = false,
}: {
  icon: React.ReactNode;
  title: string;
  stageIndex: number;
  totalStages?: number;
  ownerIcon: React.ReactNode;
  ownerLabel: string;
  ownerChip: string;
  actionIcon: React.ReactNode;
  actionText: string;
  percent: number;
  theme?: 'cream' | 'mint' | 'slate';
  live?: boolean;
}) {
  const t = THEME[theme];
  const circumference = 2 * Math.PI * 15;
  const dash = (percent / 100) * circumference;

  return (
    <div className={`relative flex items-center justify-between rounded-2xl ${t.bg} px-6 py-4`}>
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg">{icon}</div>
        <div>
          <div className="text-[17px] font-bold text-slate-900">{title}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-600">
            <span className={`rounded-md ${t.chip} px-2 py-0.5 font-semibold`}>
              Stage {stageIndex}/{totalStages}
            </span>
            <span className="text-slate-400">•</span>
            <span className="flex items-center gap-1">
              {ownerIcon} {ownerLabel}
            </span>
            <span className={`rounded-md ${t.chip} px-2 py-0.5 font-semibold`}>{ownerChip}</span>
            <span className="text-slate-400">•</span>
            <span className={`flex items-center gap-1 rounded-md ${t.chip} px-2 py-0.5`}>
              {actionIcon} {actionText}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {live && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> LIVE
          </span>
        )}
        <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
          <circle cx="20" cy="20" r="15" fill="none" stroke="#ffffff90" strokeWidth="4" />
          <circle
            cx="20"
            cy="20"
            r="15"
            fill="none"
            stroke={t.ring}
            strokeWidth="4"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="text-[12px] font-bold text-slate-700">{percent}%</span>
        <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/60 text-slate-500 hover:bg-white">
          <ChevronDown size={16} />
        </button>
      </div>
    </div>
  );
}
