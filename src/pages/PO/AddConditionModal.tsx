import React, { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Field, TextInput, TextArea, SelectInput, MultiChipSelect } from '../../components/ui/Form';
import { useData } from '../../context/DataContext';
import { VENDORS, TAX_MASTER, UOMS, CONDITION_BUNDLES } from '../../data/seed';
import { uid } from '../../data/ids';
import { BASE_STEP, computeLine, describeCalculation, formatCurrency, type ComputedConditionLine } from '../../engine/calc';
import { CALC_BASIS_LABELS, CALC_BASIS_RATE_LABEL, type AppliedCondition, type POLine, type PurchaseOrder } from '../../types';
import { CategoryBadge } from '../../components/ui/Badge';
import { AlertTriangle, Info, Eye, Layers } from 'lucide-react';

type ApplyTo = 'LINE' | 'MULTI' | 'ALL' | 'HEADER';
type Mode = 'SINGLE' | 'BUNDLE';

export function AddConditionModal({
  po,
  contextLineId,
  onClose,
  onSave,
}: {
  po: PurchaseOrder;
  contextLineId?: string;
  onClose: () => void;
  onSave: (po: PurchaseOrder) => void;
}) {
  const { conditionMasters, markConditionMasterUsed } = useData();
  const activeMasters = conditionMasters.filter((c) => c.status === 'Active');

  const [mode, setMode] = useState<Mode>('SINGLE');
  const [bundleId, setBundleId] = useState('');

  const [conditionCode, setConditionCode] = useState('');
  const [applyTo, setApplyTo] = useState<ApplyTo>(contextLineId ? 'LINE' : 'HEADER');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>(contextLineId ? [contextLineId] : po.lines.map((l) => l.id));
  const [vendorId, setVendorId] = useState('');
  const [rate, setRate] = useState<number>(0);
  const [qty, setQty] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [poForCondition, setPoForCondition] = useState('');
  const [gstOverrideOpen, setGstOverrideOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const master = activeMasters.find((c) => c.code === conditionCode);
  const bundle = CONDITION_BUNDLES.find((b) => b.id === bundleId);
  const bundleMasters = useMemo(
    () => (bundle ? bundle.conditionCodes.map((code) => conditionMasters.find((c) => c.code === code)).filter((m): m is NonNullable<typeof m> => !!m) : []),
    [bundle, conditionMasters]
  );

  const allowedApplyTo: ApplyTo[] = useMemo(() => {
    if (mode === 'BUNDLE') return ['LINE', 'MULTI', 'ALL'];
    if (!master) return ['LINE', 'MULTI', 'ALL', 'HEADER'];
    if (master.allowedLevel === 'LINE') return ['LINE', 'MULTI', 'ALL'];
    if (master.allowedLevel === 'HEADER') return ['HEADER'];
    return ['LINE', 'MULTI', 'ALL', 'HEADER'];
  }, [master, mode]);

  React.useEffect(() => {
    if (master) {
      setVendorId(master.defaultVendorId ?? po.vendorId);
      setRate(master.defaultRate ?? 0);
      setQty(['FIXED_PER_PO', 'FIXED_PER_LINE'].includes(master.calcBasis) ? 1 : contextLineId ? po.lines.find((l) => l.id === contextLineId)?.qty ?? 1 : 1);
      if (!allowedApplyTo.includes(applyTo)) setApplyTo(allowedApplyTo[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditionCode]);

  React.useEffect(() => {
    if (!allowedApplyTo.includes(applyTo)) setApplyTo(allowedApplyTo[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bundleId]);

  const vendorOptions = useMemo(() => {
    let list = VENDORS;
    if (master && master.vendorGroupFilter.length > 0) list = list.filter((v) => master.vendorGroupFilter.includes(v.vendorGroup));
    return list;
  }, [master]);

  const tax = master ? TAX_MASTER.find((t) => t.code === master.taxCode) : undefined;

  const targetLines = useMemo(() => {
    if (applyTo === 'LINE') return po.lines.filter((l) => l.id === contextLineId);
    if (applyTo === 'MULTI') return po.lines.filter((l) => selectedLineIds.includes(l.id));
    if (applyTo === 'ALL') return po.lines;
    return po.lines.filter((l) => selectedLineIds.includes(l.id));
  }, [applyTo, po.lines, selectedLineIds, contextLineId]);

  // Build a draft AppliedCondition + live preview against the first target line's existing cascade.
  const draftPreview = useMemo(() => {
    if (!master || targetLines.length === 0) return null;
    const line = targetLines[0];
    const draft: AppliedCondition = {
      id: 'draft',
      conditionCode: master.code,
      conditionName: master.name,
      category: master.category,
      level: applyTo === 'HEADER' ? 'HEADER' : 'LINE',
      lineId: applyTo === 'HEADER' ? undefined : line.id,
      calcBasis: master.calcBasis,
      calculateOn: master.calculateOn,
      calculationMode: master.calculationMode,
      calculationRule: master.calculationRule,
      minChargeAmount: master.minChargeAmount,
      maxChargeAmount: master.maxChargeAmount,
      calculateOnCodes: master.calculateOnCodes,
      calculateOnWeights: master.calculateOnWeights,
      sign: master.sign,
      rate,
      qty,
      uomId: master.uomId,
      vendorId,
      vendorName: VENDORS.find((v) => v.id === vendorId)?.name ?? '',
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
      lineItemGrnRequired: master.lineItemGrnRequired,
      status: 'Draft',
      confirmedPct: 0,
      currency: master.currency,
    };
    (draft as any).slabTable = master.slabTable;

    const tempLine = { ...line, conditions: [...line.conditions, draft] };
    const lc = computeLine(tempLine, VENDORS, po);
    const draftItem = lc.items.find((i) => i.id === 'draft')!;
    return { line, lineBaseValue: lc.lineBaseValue, items: lc.items, draftItem };
  }, [master, targetLines, rate, qty, vendorId, applyTo, tax, po.deliveryState]);

  // Bundle preview: every condition in the bundle is added to the first target line as a
  // draft, all at once — the DAG in engine/calc.ts resolves their DependsOn against each
  // other and against the line's existing conditions in the same topological sort, exactly
  // as if each had been added one-by-one. No special-casing for "this came from a bundle."
  const bundlePreview = useMemo(() => {
    if (mode !== 'BUNDLE' || bundleMasters.length === 0 || targetLines.length === 0) return null;
    const line = targetLines[0];
    const drafts: AppliedCondition[] = bundleMasters.map((m) => {
      const vendor = VENDORS.find((v) => v.id === m.defaultVendorId) ?? VENDORS.find((v) => v.id === po.vendorId);
      const t = TAX_MASTER.find((tx) => tx.code === m.taxCode);
      const draft: AppliedCondition = {
        id: `draft-${m.code}`,
        conditionCode: m.code,
        conditionName: m.name,
        category: m.category,
        level: 'LINE',
        lineId: line.id,
        calcBasis: m.calcBasis,
        calculateOn: m.calculateOn,
        calculationMode: m.calculationMode,
        calculationRule: m.calculationRule,
        minChargeAmount: m.minChargeAmount,
        maxChargeAmount: m.maxChargeAmount,
        calculateOnCodes: m.calculateOnCodes,
        calculateOnWeights: m.calculateOnWeights,
        sign: m.sign,
        rate: m.defaultRate ?? 0,
        qty: ['FIXED_PER_PO', 'FIXED_PER_LINE'].includes(m.calcBasis) ? 1 : line.qty,
        uomId: m.uomId,
        vendorId: vendor?.id ?? po.vendorId,
        vendorName: vendor?.name ?? po.vendorName,
        distributionBasis: m.distributionBasis,
        codeType: m.codeType,
        taxCode: m.taxCode,
        gstRate: t?.gstRate ?? 0,
        gstTreatment: m.gstTreatment,
        capitalise: m.capitalise,
        statistical: m.statistical,
        rounding: m.rounding,
        requiresServiceConfirmation: m.requiresServiceConfirmation,
        autoConfirmOnMainGrn: m.autoConfirmOnMainGrn,
        confirmationMode: m.confirmationOnPartialGrn,
        lineItemGrnRequired: m.lineItemGrnRequired,
        status: 'Draft',
        confirmedPct: 0,
        currency: m.currency,
      };
      (draft as any).slabTable = m.slabTable;
      return draft;
    });

    const tempLine = { ...line, conditions: [...line.conditions, ...drafts] };
    const lc = computeLine(tempLine, VENDORS, po);
    return { line, lineBaseValue: lc.lineBaseValue, items: lc.items };
  }, [mode, bundleMasters, targetLines, po.deliveryState, po.vendorId, po.vendorName]);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (targetLines.length === 0) errs.push('Select at least one line to apply this to.');

    if (mode === 'BUNDLE') {
      if (!bundle) errs.push('Select a condition bundle.');
      if (bundle && bundleMasters.length !== bundle.conditionCodes.length) {
        errs.push('One or more conditions in this bundle are missing or inactive in the Condition Master.');
      }
      bundleMasters.forEach((m) => {
        if (m.mutuallyExclusiveWith?.length) {
          const clash = targetLines.some((l) => l.conditions.some((c) => m.mutuallyExclusiveWith.includes(c.conditionCode)));
          if (clash) errs.push(`${m.code} is mutually exclusive with an existing condition on a target line (P8).`);
        }
      });
      return errs;
    }

    if (!master) errs.push('Select a condition.');
    if (!vendorId) errs.push('Vendor for Condition is required.');
    if (master?.vendorRule === 'MUST_DIFFER' && vendorId === po.vendorId) errs.push('Vendor must differ from the PO vendor for this condition (P1/P2).');
    if (master?.vendorRule === 'SAME_AS_PO' && vendorId !== po.vendorId) errs.push('This condition must use the same vendor as the PO.');
    if (master && !['FIXED_PER_PO', 'FIXED_PER_LINE'].includes(master.calcBasis)) {
      targetLines.forEach((l) => {
        if (qty > l.qty) errs.push(`Condition quantity cannot exceed line quantity (${l.qty}) on ${l.itemName} (P6).`);
      });
    }
    if (master && master.minValue != null && rate < master.minValue) errs.push(`Rate is below the minimum (${master.minValue}) — warning only.`);
    if (master && master.maxValue != null && rate > master.maxValue) errs.push(`Rate exceeds the maximum (${master.maxValue}) — approval will be required.`);
    if (master?.mutuallyExclusiveWith?.length) {
      const clash = targetLines.some((l) => l.conditions.some((c) => master.mutuallyExclusiveWith.includes(c.conditionCode)));
      if (clash) errs.push(`Mutually exclusive with an existing condition on this line (P8).`);
    }
    return errs;
  };

  const handleSaveBundle = () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0 || !bundle || targetLines.length === 0) return;

    const next: PurchaseOrder = { ...po, lines: po.lines.map((l) => ({ ...l, conditions: [...l.conditions] })), headerConditions: [...po.headerConditions] };

    // Every condition keeps the DependsOn/calculateOnCodes wiring from its own master record —
    // the bundle only decides which codes get added together, in one action. The calc engine's
    // dependency graph (engine/calc.ts) resolves ordering the same way whether these conditions
    // arrived via a bundle or were each added by hand.
    bundleMasters.forEach((m) => {
      markConditionMasterUsed(m.id);
      const vendor = VENDORS.find((v) => v.id === m.defaultVendorId) ?? VENDORS.find((v) => v.id === po.vendorId);
      const t = TAX_MASTER.find((tx) => tx.code === m.taxCode);
      const isHeader = m.allowedLevel === 'HEADER';

      const buildCond = (line?: POLine): AppliedCondition => {
        const cond: AppliedCondition = {
          id: uid('ac'),
          conditionCode: m.code,
          conditionName: m.name,
          category: m.category,
          level: isHeader ? 'HEADER' : 'LINE',
          lineId: isHeader ? undefined : line?.id,
          applyToLineIds: isHeader ? targetLines.map((l) => l.id) : undefined,
          calcBasis: m.calcBasis,
          calculateOn: m.calculateOn,
          calculationMode: m.calculationMode,
          calculationRule: m.calculationRule,
          minChargeAmount: m.minChargeAmount,
          maxChargeAmount: m.maxChargeAmount,
          calculateOnCodes: m.calculateOnCodes,
          calculateOnWeights: m.calculateOnWeights,
          sign: m.sign,
          rate: m.defaultRate ?? 0,
          qty: ['FIXED_PER_PO', 'FIXED_PER_LINE'].includes(m.calcBasis) ? 1 : line?.qty ?? 1,
          uomId: m.uomId,
          vendorId: vendor?.id ?? po.vendorId,
          vendorName: vendor?.name ?? po.vendorName,
          distributionBasis: m.distributionBasis,
          codeType: m.codeType,
          taxCode: m.taxCode,
          gstRate: t?.gstRate ?? 0,
          gstTreatment: m.gstTreatment,
          capitalise: m.capitalise,
          statistical: m.statistical,
          rounding: m.rounding,
          requiresServiceConfirmation: m.requiresServiceConfirmation,
          autoConfirmOnMainGrn: m.autoConfirmOnMainGrn,
          confirmationMode: m.confirmationOnPartialGrn,
          lineItemGrnRequired: m.lineItemGrnRequired,
          status: 'Draft',
          confirmedPct: 0,
          notes: notes || `Added via bundle: ${bundle.name}`,
          currency: m.currency,
        };
        (cond as any).slabTable = m.slabTable;
        return cond;
      };

      if (isHeader) {
        next.headerConditions.push(buildCond());
      } else {
        targetLines.forEach((line) => {
          const idx = next.lines.findIndex((l) => l.id === line.id);
          next.lines[idx].conditions.push(buildCond(line));
        });
      }
    });

    onSave(next);
    onClose();
  };

  const handleSave = () => {
    if (mode === 'BUNDLE') return handleSaveBundle();

    const errs = validate();
    // Only hard-block on the first three rule types; treat min/max as warnings shown but non-blocking here for prototype clarity.
    const blocking = errs.filter((e) => !e.includes('warning only') && !e.includes('approval will be required'));
    setErrors(errs);
    if (blocking.length > 0) return;
    if (!master) return;

    markConditionMasterUsed(master.id);

    const next: PurchaseOrder = { ...po, lines: po.lines.map((l) => ({ ...l, conditions: [...l.conditions] })), headerConditions: [...po.headerConditions] };

    if (applyTo === 'HEADER') {
      const cond: AppliedCondition = {
        id: uid('ac'),
        conditionCode: master.code,
        conditionName: master.name,
        category: master.category,
        level: 'HEADER',
        applyToLineIds: targetLines.map((l) => l.id),
        calcBasis: master.calcBasis,
        calculateOn: master.calculateOn,
        calculationMode: master.calculationMode,
        calculationRule: master.calculationRule,
        minChargeAmount: master.minChargeAmount,
        maxChargeAmount: master.maxChargeAmount,
        calculateOnCodes: master.calculateOnCodes,
        calculateOnWeights: master.calculateOnWeights,
        sign: master.sign,
        rate,
        qty,
        uomId: master.uomId,
        vendorId,
        vendorName: VENDORS.find((v) => v.id === vendorId)?.name ?? '',
        poForConditionId: poForCondition || undefined,
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
        lineItemGrnRequired: master.lineItemGrnRequired,
        status: 'Draft',
        confirmedPct: 0,
        notes: notes || undefined,
        currency: master.currency,
      };
      (cond as any).slabTable = master.slabTable;
      next.headerConditions.push(cond);
    } else {
      targetLines.forEach((line) => {
        const cond: AppliedCondition = {
          id: uid('ac'),
          conditionCode: master.code,
          conditionName: master.name,
          category: master.category,
          level: 'LINE',
          lineId: line.id,
          calcBasis: master.calcBasis,
          calculateOn: master.calculateOn,
          calculationMode: master.calculationMode,
          calculationRule: master.calculationRule,
          minChargeAmount: master.minChargeAmount,
          maxChargeAmount: master.maxChargeAmount,
          calculateOnCodes: master.calculateOnCodes,
          calculateOnWeights: master.calculateOnWeights,
          sign: master.sign,
          rate,
          qty: ['FIXED_PER_PO', 'FIXED_PER_LINE'].includes(master.calcBasis) ? 1 : qty,
          uomId: master.uomId,
          vendorId,
          vendorName: VENDORS.find((v) => v.id === vendorId)?.name ?? '',
          poForConditionId: poForCondition || undefined,
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
          lineItemGrnRequired: master.lineItemGrnRequired,
          status: 'Draft',
          confirmedPct: 0,
          notes: notes || undefined,
          currency: master.currency,
        };
        (cond as any).slabTable = master.slabTable;
        const lineIdx = next.lines.findIndex((l) => l.id === line.id);
        next.lines[lineIdx].conditions.push(cond);
      });
    }

    onSave(next);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add Conditions to Line Item"
      subtitle="Please add custom conditions on line item — the form reconfigures based on the selected condition's master data."
      width={640}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            {mode === 'BUNDLE' ? 'Apply Bundle' : 'Add Condition'}
          </button>
        </div>
      }
    >
      {errors.length > 0 && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-rose-700">
            <AlertTriangle size={15} /> Check before adding
          </div>
          <ul className="mt-1.5 list-disc pl-5 text-[12.5px] text-rose-600">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <Field label="Mode">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('SINGLE')}
              className={`rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition ${
                mode === 'SINGLE' ? 'border-indigo-brand bg-indigo-brand text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Single Condition
            </button>
            <button
              type="button"
              onClick={() => setMode('BUNDLE')}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition ${
                mode === 'BUNDLE' ? 'border-indigo-brand bg-indigo-brand text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <Layers size={13} /> Condition Bundle
            </button>
          </div>
        </Field>

        {mode === 'SINGLE' && (
          <Field label="Select Condition" required>
            <SelectInput
              value={conditionCode}
              onChange={setConditionCode}
              placeholder="Select Condition"
              options={activeMasters.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
            />
            {master && (
              <div className="mt-2 flex items-center gap-2">
                <CategoryBadge category={master.category} />
                {master.description && <span className="text-[12px] text-slate-400">{master.description}</span>}
              </div>
            )}
          </Field>
        )}

        {mode === 'BUNDLE' && (
          <Field label="Select Bundle" required hint="Applies every condition in the bundle in one step. Each keeps its own Calculate-On wiring from the Condition Master, so the cascade resolves exactly as if they'd been added one at a time.">
            <SelectInput
              value={bundleId}
              onChange={setBundleId}
              placeholder="Select Condition Bundle"
              options={CONDITION_BUNDLES.map((b) => ({ value: b.id, label: b.name }))}
            />
            {bundle && (
              <div className="mt-2 space-y-1.5">
                <div className="text-[12px] text-slate-400">{bundle.description}</div>
                <div className="flex flex-wrap gap-1.5">
                  {bundleMasters.map((m) => (
                    <span key={m.code} className="field-chip !py-1 text-[11px]">
                      {m.code} — {m.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Field>
        )}

        {(master || (mode === 'BUNDLE' && bundle)) && (
          <>
            <Field label="Apply To" required>
              <div className="flex flex-wrap gap-2">
                {allowedApplyTo.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setApplyTo(opt)}
                    className={`rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition ${
                      applyTo === opt ? 'border-indigo-brand bg-indigo-brand text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {{ LINE: 'This line', MULTI: 'Selected lines', ALL: 'All lines', HEADER: 'Whole PO' }[opt]}
                  </button>
                ))}
              </div>
            </Field>

            {(applyTo === 'MULTI' || applyTo === 'HEADER') && (
              <Field label="Lines">
                <MultiChipSelect
                  value={selectedLineIds}
                  onChange={setSelectedLineIds}
                  options={po.lines.map((l) => ({ value: l.id, label: `#${l.lineNo} ${l.itemName}` }))}
                />
              </Field>
            )}

            {mode === 'SINGLE' && master && (
              <>
            <Field label="PO for Condition (optional)" hint="Links an existing PO raised on the logistics/service vendor for this charge.">
              <TextInput value={poForCondition} onChange={(e) => setPoForCondition(e.target.value)} placeholder="PO for Condition (optional)" />
            </Field>

            <Field label="Vendor for Condition" required>
              <SelectInput value={vendorId} onChange={setVendorId} options={vendorOptions.map((v) => ({ value: v.id, label: v.name }))} />
            </Field>

            {vendorId && (
              <div className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/60 px-3.5 py-2.5">
                <Eye size={14} className="mt-0.5 shrink-0 text-sky-500" />
                <p className="text-[12px] leading-snug text-sky-800">
                  {vendorId === po.vendorId ? (
                    <>Visible on the <span className="font-semibold">material vendor's</span> PO copy — same vendor as the PO header.</>
                  ) : (
                    <>
                      Visible only on <span className="font-semibold">{VENDORS.find((v) => v.id === vendorId)?.name}'s</span> document (e.g. a Freight
                      Advice or Clearing Instruction) — hidden from {po.vendorName} and every other condition vendor on this PO.
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Basis">
                <div className="field-chip w-full justify-between">{CALC_BASIS_LABELS[master.calcBasis]}</div>
              </Field>
              <Field label={CALC_BASIS_RATE_LABEL[master.calcBasis]} required>
                <TextInput type="number" value={rate} disabled={!master.rateEditableOnPo} onChange={(e) => setRate(Number(e.target.value))} />
              </Field>
            </div>

            <Field label="Quantity" hint={['FIXED_PER_PO', 'FIXED_PER_LINE'].includes(master.calcBasis) ? 'Locked — fixed-basis condition (P7 auto-correct).' : undefined}>
              <TextInput
                type="number"
                value={['FIXED_PER_PO', 'FIXED_PER_LINE'].includes(master.calcBasis) ? 1 : qty}
                disabled={['FIXED_PER_PO', 'FIXED_PER_LINE'].includes(master.calcBasis)}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </Field>

            <Field label={`${master.codeType} + GST`}>
              <div className="flex items-center gap-2">
                <span className="field-chip">{master.taxCode ?? '—'}</span>
                <span className="field-chip">{tax ? `${tax.gstRate}% GST` : 'No GST'}</span>
                {master.gstTreatment === 'RCM' && <span className="field-chip !bg-amber-50 !text-amber-700">RCM — not payable to vendor</span>}
                <button type="button" onClick={() => setGstOverrideOpen((v) => !v)} className="text-[12px] font-semibold text-indigo-brand">
                  Override
                </button>
              </div>
              {gstOverrideOpen && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                  <TextInput type="number" placeholder="Override GST %" className="!bg-white" />
                  <TextInput placeholder="Reason (required, audited)" className="!bg-white" />
                </div>
              )}
            </Field>

            <Field label="Notes + Attachment">
              <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Please add a note" />
            </Field>

            {draftPreview && (
              <div className="rounded-xl border border-indigo-100 bg-lav-100 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-indigo-brand">
                  <Info size={13} /> Live Calculation
                </div>
                {applyTo !== 'LINE' && (
                  <div className="mb-2 text-[11.5px] text-slate-400">
                    Previewed against #{draftPreview.line.lineNo} {draftPreview.line.itemName} — other lines will differ by their own qty/weight/value.
                  </div>
                )}

                <CascadeTable line={draftPreview.line} lineBaseValue={draftPreview.lineBaseValue} items={draftPreview.items} currency={po.currency} />

                <div className="mt-3 space-y-1.5 text-[13px]">
                  <Row
                    label={`GST @ ${draftPreview.draftItem.gstRate}%${master.gstTreatment === 'RCM' ? ' (RCM)' : ''}`}
                    value={formatCurrency(draftPreview.draftItem.computedGstAmount, po.currency)}
                    note={master.gstTreatment === 'RCM' ? 'not payable' : master.statistical ? 'statistical' : undefined}
                  />
                  <div className="my-1.5 border-t border-indigo-200" />
                  <Row
                    label="This condition — Total (incl. GST)"
                    value={formatCurrency(
                      draftPreview.draftItem.computedAmount + (master.gstTreatment === 'RCM' ? 0 : draftPreview.draftItem.computedGstAmount),
                      po.currency
                    )}
                    strong
                  />
                </div>
              </div>
            )}
              </>
            )}

            {mode === 'BUNDLE' && bundlePreview && (
              <div className="rounded-xl border border-indigo-100 bg-lav-100 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-indigo-brand">
                  <Info size={13} /> Live Calculation — bundle preview
                </div>
                {targetLines.length > 1 && (
                  <div className="mb-2 text-[11.5px] text-slate-400">
                    Previewed against #{bundlePreview.line.lineNo} {bundlePreview.line.itemName} — other lines will differ by their own qty/weight/value.
                    Header-level conditions in this bundle will be computed once at PO scope and distributed across all {targetLines.length} target lines.
                  </div>
                )}

                <CascadeTable line={bundlePreview.line} lineBaseValue={bundlePreview.lineBaseValue} items={bundlePreview.items} currency={po.currency} />

                <div className="mt-3 space-y-1.5 text-[13px]">
                  <Row
                    label={`This bundle — ${bundleMasters.length} condition${bundleMasters.length === 1 ? '' : 's'} added, Net effect`}
                    value={formatCurrency(
                      bundlePreview.items.filter((i) => i.id.startsWith('draft-')).reduce((s, i) => s + i.computedAmount, 0),
                      po.currency
                    )}
                    strong
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value, strong, note }: { label: string; value: string; strong?: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`flex items-center gap-1.5 ${strong ? 'font-bold text-slate-800' : 'text-slate-700'}`}>
        {value}
        {note && <span className="text-[10.5px] font-medium text-slate-400">ⓘ {note}</span>}
      </span>
    </div>
  );
}

// Running-cascade preview: Condition | Calculate On | Rate | Calculation | Amount | Running
// — order is dependency-derived (engine/calc.ts orderByDependency), not a sequence number.
function CascadeTable({
  line,
  lineBaseValue,
  items,
  currency,
}: {
  line: POLine;
  lineBaseValue: number;
  items: ComputedConditionLine[];
  currency: string;
}) {
  // Compact "Calculate On" label — dispatches on the new calculationMode first
  // (BASE/DIRECT reduce to Base; SELECTED_CONDITIONS shows its weighted-step formula;
  // CONDITIONAL/SLAB/CUMULATIVE get a short mode tag), falling back to the legacy
  // calculateOn/calculateOnCodes reading for any condition saved before this model.
  const calculateOnLabel = (item: ComputedConditionLine) => {
    if (item.calculationMode === 'SELECTED_CONDITIONS' && item.calculationRule?.mode === 'SELECTED_CONDITIONS') {
      const steps = item.calculationRule.selected.steps;
      if (steps.length === 0) return '—';
      return steps
        .map((s, i) => {
          const label = s.source === 'BASE' ? 'Base' : s.conditionCode ?? '?';
          const kind = s.valueKind === 'CONDITION_BASE' ? '(Base)' : '';
          const pctText = s.percentage === 100 ? '' : `${s.percentage}%`;
          const signText = s.operator === '-' ? '-' : i > 0 ? '+' : '';
          return `${signText}${pctText}${label}${kind}`;
        })
        .join('');
    }
    if (item.calculationMode === 'BASE' || item.calculationMode === 'DIRECT') return 'Base';
    if (item.calculationMode === 'CONDITIONAL') return 'Conditional';
    if (item.calculationMode === 'SLAB') return 'Slab tier';
    if (item.calculationMode === 'CUMULATIVE') return 'Cumulative';

    if (item.calculateOn === 'LINE_BASE') return 'Base';
    const weights = item.calculateOnWeights ?? {};
    const term = (c: string) => {
      const label = c === BASE_STEP ? 'Base' : c;
      const w = weights[c] ?? 100;
      return w === 100 ? `${label}` : `${w}%${label}`;
    };
    return item.calculateOnCodes.length ? item.calculateOnCodes.map(term).join('+') : '—';
  };

  const rateLabel = (item: ComputedConditionLine) => {
    if (item.calculationMode === 'CONDITIONAL') {
      const f = item.effectiveFormula;
      if (!f) return '—';
      if (f.type === 'PERCENTAGE') return `${f.value}%`;
      if (f.type === 'FIXED') return formatCurrency(f.value, currency);
      const uom = UOMS.find((u) => u.id === f.uomId)?.name;
      return `${f.value}${uom ? ' /' + uom : ''}`;
    }
    if (item.calculationMode === 'SLAB' || item.calculationMode === 'CUMULATIVE') return 'Tier grid';
    if (item.calcBasis === 'PCT_OF_LINE_BASE' || item.calcBasis === 'PCT_OF_SELECTED_BASE') return `${item.rate}%`;
    if (item.calcBasis === 'FIXED_PER_PO' || item.calcBasis === 'FIXED_PER_LINE') return formatCurrency(item.rate, currency);
    if (item.calcBasis === 'SLAB') return 'Slab grid';
    const uom = UOMS.find((u) => u.id === item.uomId)?.name;
    return `${item.rate}${uom ? ' /' + uom : ''}`;
  };

  let running = lineBaseValue;

  return (
    <div className="overflow-x-auto rounded-lg border border-indigo-200 bg-white">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-indigo-50 text-left text-[10.5px] font-bold uppercase tracking-wide text-indigo-brand">
            <th className="px-2.5 py-1.5">Condition</th>
            <th className="px-2.5 py-1.5">Calculate On</th>
            <th className="px-2.5 py-1.5">Rate</th>
            <th className="px-2.5 py-1.5">Calculation</th>
            <th className="px-2.5 py-1.5 text-right">Amount</th>
            <th className="px-2.5 py-1.5 text-right">Running</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-indigo-100">
            <td className="px-2.5 py-1.5 text-slate-400">—</td>
            <td className="px-2.5 py-1.5 font-semibold text-slate-700">Base</td>
            <td className="px-2.5 py-1.5 text-slate-400">—</td>
            <td className="px-2.5 py-1.5 text-slate-400">—</td>
            <td className="px-2.5 py-1.5 text-slate-400">
              {line.qty} × {formatCurrency(line.unitPrice, currency)}
            </td>
            <td className="px-2.5 py-1.5 text-right font-semibold">{formatCurrency(lineBaseValue, currency)}</td>
            <td className="px-2.5 py-1.5 text-right font-semibold">{formatCurrency(lineBaseValue, currency)}</td>
          </tr>
          {items.map((item) => {
            running += item.computedAmount;
            const isDraft = item.id === 'draft';
            return (
              <tr key={item.id} className={`border-t border-indigo-100 ${isDraft ? 'bg-indigo-50/70' : ''}`}>
                <td className={`px-2.5 py-1.5 ${isDraft ? 'font-bold text-indigo-brand' : 'text-slate-700'}`}>
                  {item.conditionName}
                  {isDraft && <span className="ml-1.5 rounded bg-indigo-brand px-1.5 py-0.5 text-[9.5px] font-bold text-white">NEW</span>}
                </td>
                <td className="px-2.5 py-1.5 text-slate-500">{calculateOnLabel(item)}</td>
                <td className="px-2.5 py-1.5 text-slate-500">{rateLabel(item)}</td>
                <td className="px-2.5 py-1.5 text-slate-500">
                  {describeCalculation(item, UOMS.find((u) => u.id === item.uomId)?.name, currency)}
                </td>
                <td className={`px-2.5 py-1.5 text-right font-semibold ${item.computedAmount < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {formatCurrency(item.computedAmount, currency)}
                </td>
                <td className={`px-2.5 py-1.5 text-right ${isDraft ? 'font-bold text-indigo-brand' : 'font-semibold text-slate-800'}`}>
                  {formatCurrency(running, currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
