import type { ReactNode } from 'react';
import { Modal } from '../../components/ui/Modal';
import { CategoryBadge } from '../../components/ui/Badge';
import { BASE_STEP, describeCalculation, formatCurrency, type ComputedConditionLine } from '../../engine/calc';
import { CALC_BASIS_LABELS, CALC_BASIS_RATE_LABEL, GST_TREATMENT_LABELS } from '../../types';

const JURISDICTION_LABELS: Record<ComputedConditionLine['jurisdiction'], string> = {
  CGST_SGST: 'CGST + SGST (intra-state)',
  CGST_UTGST: 'CGST + UTGST (intra-UT)',
  IGST: 'IGST (inter-state)',
  RCM: 'Reverse charge (self-assessed, not paid to vendor)',
  NONE: 'Not applicable',
};

function calculateOnDescription(item: ComputedConditionLine, nameByCode: Record<string, string>): string {
  if (item.calculateOn === 'LINE_BASE') return 'Line base value';
  if (item.calculateOnCodes.length === 0) return '—';
  return item.calculateOnCodes.map((code) => (code === BASE_STEP ? 'Base' : nameByCode[code] ?? code)).join(' + ');
}

function rateDisplay(item: ComputedConditionLine, uomName: string | undefined, currency: string): string {
  switch (item.calcBasis) {
    case 'PCT_OF_LINE_BASE':
    case 'PCT_OF_SELECTED_BASE':
      return `${item.rate}%`;
    case 'FIXED_PER_PO':
    case 'FIXED_PER_LINE':
      return formatCurrency(item.rate, currency);
    case 'SLAB':
      return 'Slab grid (see condition master)';
    default:
      return `${item.rate}${uomName ? ' / ' + uomName : ''}`;
  }
}

function Row({ label, value, bold, muted }: { label: string; value: ReactNode; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-[12.5px] ${muted ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-[13px] ${bold ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{value}</span>
    </div>
  );
}

export function ConditionCalcModal({
  item,
  currency,
  uomName,
  nameByCode,
  lineLabel,
  onClose,
}: {
  item: ComputedConditionLine;
  currency: string;
  uomName: string | undefined;
  nameByCode: Record<string, string>;
  lineLabel: string;
  onClose: () => void;
}) {
  const totalPayable = item.jurisdiction === 'RCM' ? item.computedAmount : item.computedAmount + item.computedGstAmount;
  const hasGstSplit = item.cgst > 0 || item.sgst > 0 || item.igst > 0 || item.utgst > 0 || item.rcmAmount > 0;

  return (
    <Modal open onClose={onClose} title="How this amount was calculated" subtitle={`${item.conditionName} · Seq ${item.sequence} · ${lineLabel}`} width={520}>
      <div className="mb-4 flex items-center gap-2">
        <CategoryBadge category={item.category} />
        <span className="badge bg-slate-100 text-slate-600">{item.sign === '-' ? 'Deduction' : 'Addition'}</span>
        {item.statistical && <span className="badge bg-slate-100 text-slate-600">Statistical only</span>}
        {item.capitalise && <span className="badge bg-lav-100 text-indigo-brand">Capitalised</span>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-1">
        <Row label="Calculation Basis" value={CALC_BASIS_LABELS[item.calcBasis]} />
        <Row label="Calculate On" value={calculateOnDescription(item, nameByCode)} />
        <Row label={CALC_BASIS_RATE_LABEL[item.calcBasis]} value={rateDisplay(item, uomName, currency)} />
        <div className="my-1 border-t border-slate-200" />
        <Row label="Formula" value={describeCalculation(item, uomName, currency)} bold />
        <Row label="Rounding" value={item.rounding === 'NONE' ? 'None (2 decimals)' : item.rounding === 'NORMAL' ? 'Nearest whole' : item.rounding === 'UP' ? 'Round up' : 'Round down'} muted />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3">
        <span className="text-[13px] font-semibold text-indigo-brand">Condition Amount</span>
        <span className={`text-[16px] font-bold ${item.computedAmount < 0 ? 'text-rose-600' : 'text-indigo-brand'}`}>
          {formatCurrency(item.computedAmount, currency)}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 px-4 py-1">
        <div className="pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Tax</div>
        <Row label="GST Treatment" value={GST_TREATMENT_LABELS[item.gstTreatment]} />
        <Row label="GST Rate" value={`${item.gstRate}%`} />
        <Row label="Jurisdiction" value={JURISDICTION_LABELS[item.jurisdiction]} />
        {hasGstSplit && (
          <>
            <div className="my-1 border-t border-slate-100" />
            {item.cgst > 0 && <Row label="CGST" value={formatCurrency(item.cgst, currency)} muted />}
            {item.sgst > 0 && <Row label="SGST" value={formatCurrency(item.sgst, currency)} muted />}
            {item.utgst > 0 && <Row label="UTGST" value={formatCurrency(item.utgst, currency)} muted />}
            {item.igst > 0 && <Row label="IGST" value={formatCurrency(item.igst, currency)} muted />}
            {item.rcmAmount > 0 && <Row label="RCM (self-assessed)" value={formatCurrency(item.rcmAmount, currency)} muted />}
          </>
        )}
        <div className="my-1 border-t border-slate-100" />
        <Row label="GST Amount" value={formatCurrency(item.computedGstAmount, currency)} bold />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3">
        <span className="text-[13px] font-semibold text-slate-200">
          Total {item.jurisdiction === 'RCM' ? '(excl. RCM GST)' : '(condition + GST)'}
        </span>
        <span className="text-[16px] font-bold text-white">{formatCurrency(totalPayable, currency)}</span>
      </div>
    </Modal>
  );
}
