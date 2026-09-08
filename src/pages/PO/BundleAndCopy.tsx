import { useState } from 'react';
import { Layers, Copy, ChevronDown } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { CONDITION_BUNDLES, VENDORS, TAX_MASTER } from '../../data/seed';
import { uid } from '../../data/ids';
import type { AppliedCondition, PurchaseOrder } from '../../types';

export function BundleAndCopy({
  po,
  targetLineId,
  onUpdate,
  disabled,
}: {
  po: PurchaseOrder;
  targetLineId?: string;
  onUpdate: (po: PurchaseOrder) => void;
  disabled?: boolean;
}) {
  const { conditionMasters, purchaseOrders, markConditionMasterUsed } = useData();
  const [bundleOpen, setBundleOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const applyBundle = (bundleId: string) => {
    const bundle = CONDITION_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) return;
    const line = targetLineId ? po.lines.find((l) => l.id === targetLineId) : po.lines[0];
    if (!line) return;

    const next: PurchaseOrder = { ...po, lines: po.lines.map((l) => ({ ...l, conditions: [...l.conditions] })), headerConditions: [...po.headerConditions] };

    bundle.conditionCodes.forEach((code) => {
      const master = conditionMasters.find((c) => c.code === code);
      if (!master) return;
      markConditionMasterUsed(master.id);
      const vendor = VENDORS.find((v) => v.id === master.defaultVendorId) ?? VENDORS.find((v) => v.id === po.vendorId);
      const tax = TAX_MASTER.find((t) => t.code === master.taxCode);
      const cond: AppliedCondition = {
        id: uid('ac'),
        conditionCode: master.code,
        conditionName: master.name,
        category: master.category,
        level: master.allowedLevel === 'HEADER' ? 'HEADER' : 'LINE',
        lineId: master.allowedLevel === 'HEADER' ? undefined : line.id,
        applyToLineIds: master.allowedLevel === 'HEADER' ? [line.id] : undefined,
        sequence: master.sequence,
        calcBasis: master.calcBasis,
        calculateOn: master.calculateOn,
        calculateOnCodes: master.calculateOnCodes,
        sign: master.sign,
        rate: master.defaultRate ?? 0,
        qty: line.qty,
        uomId: master.uomId,
        vendorId: vendor?.id ?? po.vendorId,
        vendorName: vendor?.name ?? po.vendorName,
        distributionBasis: master.distributionBasis,
        codeType: master.codeType,
        taxCode: master.taxCode,
        gstRate: tax?.gstRate ?? 0,
        gstTreatment: master.gstTreatment,
        capitalise: master.capitalise,
        statistical: master.statistical,
        rounding: master.rounding,
        requiresServiceConfirmation: master.requiresServiceConfirmation,
        autoConfirmOnMainGrn: master.autoConfirmOnMainGrn,
        confirmationMode: master.confirmationOnPartialGrn,
        status: 'Draft',
        confirmedPct: 0,
        currency: master.currency,
        notes: `Added via bundle: ${bundle.name}`,
      };
      (cond as any).slabTable = master.slabTable;
      if (cond.level === 'HEADER') next.headerConditions.push(cond);
      else {
        const idx = next.lines.findIndex((l) => l.id === line.id);
        next.lines[idx].conditions.push(cond);
      }
    });

    onUpdate(next);
    setBundleOpen(false);
  };

  const copyFrom = (sourcePoId: string) => {
    const source = purchaseOrders.find((p) => p.id === sourcePoId);
    const line = targetLineId ? po.lines.find((l) => l.id === targetLineId) : po.lines[0];
    if (!source || !line) return;
    const next: PurchaseOrder = { ...po, lines: po.lines.map((l) => ({ ...l, conditions: [...l.conditions] })), headerConditions: [...po.headerConditions] };
    const sourceConditions = [...source.lines.flatMap((l) => l.conditions), ...source.headerConditions];
    sourceConditions.forEach((c) => {
      const master = conditionMasters.find((m) => m.code === c.conditionCode);
      if (master) markConditionMasterUsed(master.id);
      const clone: AppliedCondition = { ...c, id: uid('ac'), level: 'LINE', lineId: line.id, applyToLineIds: undefined, status: 'Draft', confirmedPct: 0, notes: `Copied from ${source.poNumber}` };
      const idx = next.lines.findIndex((l) => l.id === line.id);
      next.lines[idx].conditions.push(clone);
    });
    onUpdate(next);
    setCopyOpen(false);
  };

  const title = disabled ? `Locked — PO is ${po.stage}. Conditions can only be added while the PO is in Draft.` : undefined;

  return (
    <div className="flex gap-2">
      <div className="relative">
        <button onClick={() => setBundleOpen((v) => !v)} disabled={disabled} title={title} className="btn-secondary !py-2">
          <Layers size={14} /> Condition Bundles <ChevronDown size={13} />
        </button>
        {bundleOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {CONDITION_BUNDLES.map((b) => (
              <button key={b.id} onClick={() => applyBundle(b.id)} className="w-full rounded-lg p-2.5 text-left hover:bg-slate-50">
                <div className="text-[13px] font-semibold text-slate-800">{b.name}</div>
                <div className="text-[11.5px] text-slate-400">{b.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <button onClick={() => setCopyOpen((v) => !v)} disabled={disabled} title={title} className="btn-secondary !py-2">
          <Copy size={14} /> Copy from PO <ChevronDown size={13} />
        </button>
        {copyOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {purchaseOrders.filter((p) => p.id !== po.id).map((p) => (
              <button key={p.id} onClick={() => copyFrom(p.id)} className="w-full rounded-lg p-2.5 text-left hover:bg-slate-50">
                <div className="text-[13px] font-semibold text-slate-800">{p.poNumber}</div>
                <div className="text-[11.5px] text-slate-400">{p.vendorName} · {p.lines.reduce((s, l) => s + l.conditions.length, 0) + p.headerConditions.length} conditions</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
