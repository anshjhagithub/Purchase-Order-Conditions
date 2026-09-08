
import type { CategoryCode, POStage } from '../../types';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../types';

export function CategoryBadge({ category, short = false }: { category: CategoryCode; short?: boolean }) {
  const c = CATEGORY_COLORS[category];
  return (
    <span className={`badge ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {short ? category : CATEGORY_LABELS[category]}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-600',
    Confirmed: 'bg-emerald-50 text-emerald-700',
    'Partially Confirmed': 'bg-amber-50 text-amber-700',
    Active: 'bg-emerald-50 text-emerald-700',
    Inactive: 'bg-slate-100 text-slate-500',
  };
  return <span className={`badge ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}

// Terse PO-list status chips (PRD-facing pages use the full stage names; this
// mirrors the shorthand the real Dice app's PO list table uses — GRN, DRAFT, etc.)
const PO_STAGE_BADGE: Record<POStage, { label: string; className: string }> = {
  Draft: { label: 'DRAFT', className: 'bg-slate-100 text-slate-600' },
  'Pending Approval': { label: 'APPROVAL', className: 'bg-amber-50 text-amber-700' },
  Approved: { label: 'APPROVED', className: 'bg-sky-50 text-sky-700' },
  'Sent to Vendor': { label: 'VENDOR_ACK', className: 'bg-violet-50 text-violet-700' },
  'Goods Receipt Pending': { label: 'GRN', className: 'bg-blue-50 text-blue-700' },
  'Invoice Pending': { label: 'INVOICE', className: 'bg-teal-50 text-teal-700' },
  Closed: { label: 'CLOSED', className: 'bg-emerald-50 text-emerald-700' },
};

export function PoStageBadge({ stage }: { stage: POStage }) {
  const { label, className } = PO_STAGE_BADGE[stage];
  return <span className={`badge ${className}`}>{label}</span>;
}

export function poStageShortLabel(stage: POStage): string {
  return PO_STAGE_BADGE[stage].label;
}
