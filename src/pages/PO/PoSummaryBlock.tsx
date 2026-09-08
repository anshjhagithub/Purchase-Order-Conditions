
import type { POComputation } from '../../engine/calc';
import { formatCurrency } from '../../engine/calc';
import type { PurchaseOrder } from '../../types';

function Line({ label, value, indent, bold, muted }: { label: string; value: string; indent?: boolean; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${indent ? 'pl-4' : ''}`}>
      <span className={`text-[13px] ${bold ? 'font-bold text-slate-800' : muted ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-[13.5px] ${bold ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{value}</span>
    </div>
  );
}

export function PoSummaryBlock({ po, comp }: { po: PurchaseOrder; comp: POComputation }) {
  const c = po.currency;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-3 text-[14px] font-bold text-slate-800">PO Summary</div>
      <div className="max-w-md">
        <Line label="Base Amount (main items)" value={formatCurrency(comp.baseAmount, c)} bold />
        <Line label="+ Discounts" value={formatCurrency(comp.categoryTotals.DISC, c)} indent />
        <Line label="+ Surcharges" value={formatCurrency(comp.categoryTotals.SURC, c)} indent />
        <Line label="+ Logistics conditions" value={formatCurrency(comp.categoryTotals.LOGI, c)} indent />
        <Line label="+ Duties" value={formatCurrency(comp.categoryTotals.STAT, c)} indent />
        <Line label="+ Deductions" value={formatCurrency(comp.categoryTotals.DEDN, c)} indent />
        <Line label="+ Other charges" value={formatCurrency(comp.categoryTotals.OTHR, c)} indent />
        <div className="my-1.5 border-t border-slate-200" />
        <Line label="Taxable Value" value={formatCurrency(comp.taxableValue, c)} bold />
        {comp.cgstTotal > 0 && <Line label="+ CGST" value={formatCurrency(comp.cgstTotal, c)} indent />}
        {comp.sgstTotal > 0 && <Line label="+ SGST" value={formatCurrency(comp.sgstTotal, c)} indent />}
        {comp.utgstTotal > 0 && <Line label="+ UTGST" value={formatCurrency(comp.utgstTotal, c)} indent />}
        {comp.igstTotal > 0 && <Line label="+ IGST" value={formatCurrency(comp.igstTotal, c)} indent />}
        <div className="my-1.5 border-t-2 border-slate-800" />
        <Line label="PO Total" value={formatCurrency(comp.poTotal, c)} bold />

        <div className="mt-4 space-y-1 border-t border-dashed border-slate-200 pt-3">
          {comp.vendorPayables.map((v) => (
            <Line key={v.vendorId + v.vendorName} label={`of which payable to ${v.vendorName}`} value={formatCurrency(v.amount, c)} muted indent />
          ))}
          {comp.rcmTotal > 0 && <Line label="of which RCM (self-assessed, not paid to vendor)" value={formatCurrency(comp.rcmTotal, c)} muted indent />}
          {comp.statisticalTotal !== 0 && <Line label="Statistical only (not in PO total)" value={formatCurrency(comp.statisticalTotal, c)} muted indent />}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-lav-100 px-3.5 py-2.5">
          <span className="text-[12.5px] font-semibold text-slate-600">Landed cost (capitalising conditions only)</span>
          <span className="text-[13.5px] font-bold text-indigo-brand">{formatCurrency(comp.landedCost, c)}</span>
        </div>
      </div>
    </div>
  );
}
