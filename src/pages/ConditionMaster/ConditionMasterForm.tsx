import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Field, TextInput, TextArea, SelectInput, Toggle, Accordion, MultiChipSelect } from '../../components/ui/Form';
import { useData } from '../../context/DataContext';
import { CATEGORY_PRESETS } from '../../data/categoryPresets';
import { SUBCATEGORY_OPTIONS } from '../../data/subcategories';
import { TAX_MASTER, UOMS, VENDORS, ENTITIES, INDEX_MASTER } from '../../data/seed';
import { BASE_STEP } from '../../engine/calc';
import { uid } from '../../data/ids';
import {
  CATEGORY_LABELS,
  CALC_BASIS_LABELS,
  CALC_BASIS_RATE_LABEL,
  GST_TREATMENT_LABELS,
  VENDOR_RULE_LABELS,
  DISTRIBUTION_LABELS,
  type CategoryCode,
  type CalculationBasis,
  type ConditionMaster,
  type SlabRow,
} from '../../types';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

const SPEND_CATEGORIES = ['Batteries', 'Electronics', 'Fabrication', 'Packaging Material', 'MRO', 'Petroleum'];
const INCOTERMS = ['EXW', 'FOB', 'CIF', 'CFR', 'DAP', 'DDP'];
const VENDOR_GROUPS = Array.from(new Set(VENDORS.map((v) => v.vendorGroup)));

function emptyCondition(): ConditionMaster {
  const preset = CATEGORY_PRESETS.OTHR;
  return {
    id: uid('cm'),
    code: '',
    name: '',
    category: 'OTHR',
    subCategory: '',
    description: '',
    printOnPdf: true,
    calcBasis: preset.calcBasis!,
    uomId: undefined,
    defaultRate: undefined,
    sign: preset.sign!,
    currency: 'INR',
    statistical: false,
    rounding: 'NORMAL',
    codeType: preset.codeType!,
    taxCode: undefined,
    gstRate: undefined,
    gstTreatment: 'DEDUCTIBLE',
    itcEligibilityPct: 100,
    taxCalculatedOn: 'CONDITION_AMOUNT',
    tdsApplicable: false,
    tdsSection: '',
    defaultVendorId: undefined,
    vendorRule: preset.vendorRule!,
    vendorGroupFilter: [],
    defaultInvoiceOwner: '',
    defaultConfirmationOwner: '',
    sequence: preset.sequenceBand[0],
    calculateOn: 'LINE_BASE',
    calculateOnCodes: [],
    capitalise: preset.capitalise!,
    allowedLevel: preset.allowedLevel!,
    distributionBasis: 'VALUE',
    requiresServiceConfirmation: preset.requiresServiceConfirmation!,
    autoConfirmOnMainGrn: false,
    confirmationOnPartialGrn: 'PROPORTIONAL',
    rateEditableOnPo: preset.rateEditableOnPo!,
    vendorEditableOnPo: true,
    minValue: undefined,
    maxValue: undefined,
    approvalThreshold: undefined,
    applicabilityEntities: [],
    applicabilityCategories: [],
    applicabilityVendors: [],
    mandatoryFor: [],
    mutuallyExclusiveWith: [],
    requiresAttachment: false,
    reversible: false,
    releaseTrigger: undefined,
    slabTable: [],
    indexReferenceId: undefined,
    indexRevisionFrequency: 'Monthly',
    indexRevisionLag: 1,
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: undefined,
    status: 'Active',
    version: 1,
    usedOnAnyPo: false,
  };
}

export function ConditionMasterForm({ existing, onClose }: { existing: ConditionMaster | null; onClose: () => void }) {
  const { conditionMasters, upsertConditionMaster } = useData();
  const [form, setForm] = useState<ConditionMaster>(existing ? { ...existing } : emptyCondition());
  const [errors, setErrors] = useState<string[]>([]);
  const [gstOverride, setGstOverride] = useState(false);

  const set = <K extends keyof ConditionMaster>(key: K, value: ConditionMaster[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onCategoryChange = (category: CategoryCode) => {
    const preset = CATEGORY_PRESETS[category];
    setForm((f) => ({
      ...f,
      category,
      subCategory: SUBCATEGORY_OPTIONS[category].includes(f.subCategory ?? '') ? f.subCategory : '',
      sign: preset.sign!,
      calcBasis: preset.calcBasis!,
      codeType: preset.codeType!,
      vendorRule: preset.vendorRule!,
      capitalise: preset.capitalise!,
      requiresServiceConfirmation: preset.requiresServiceConfirmation!,
      rateEditableOnPo: preset.rateEditableOnPo!,
      allowedLevel: preset.allowedLevel!,
      calculateOn: preset.calculateOn ?? 'LINE_BASE',
      sequence: preset.sequenceBand[0],
    }));
  };

  const lowerSequenceCodes = useMemo(
    () =>
      conditionMasters
        .filter((c) => c.sequence < form.sequence && c.id !== form.id)
        .map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` })),
    [conditionMasters, form.sequence, form.id]
  );

  const taxOptions = TAX_MASTER.filter((t) => t.codeType === form.codeType);
  const selectedTax = TAX_MASTER.find((t) => t.code === form.taxCode);

  const showUom = ['RATE_X_QTY', 'RATE_X_WEIGHT', 'RATE_X_VOLUME'].includes(form.calcBasis);
  const uomOptions = UOMS.filter((u) => {
    if (form.calcBasis === 'RATE_X_WEIGHT') return u.dimension === 'WEIGHT';
    if (form.calcBasis === 'RATE_X_VOLUME') return u.dimension === 'VOLUME';
    if (form.calcBasis === 'RATE_X_QTY') return u.dimension === 'COUNT';
    return true;
  });

  const isCategoryLocked = form.usedOnAnyPo;
  const isSignLocked = CATEGORY_PRESETS[form.category].signLocked;

  const handleSlabAdd = () => {
    const last = form.slabTable[form.slabTable.length - 1];
    const row: SlabRow = { id: uid('slab'), from: last ? last.to : 0, to: last ? last.to + 50000 : 50000, rate: 1 };
    set('slabTable', [...form.slabTable, row]);
  };
  const handleSlabChange = (id: string, key: keyof SlabRow, value: number) => {
    set('slabTable', form.slabTable.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };
  const handleSlabRemove = (id: string) => set('slabTable', form.slabTable.filter((r) => r.id !== id));

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.code.trim()) errs.push('Condition Code is required.');
    else if (!/^[A-Z0-9-]{1,20}$/.test(form.code)) errs.push('Condition Code must be uppercase alphanumeric + hyphen, max 20 chars.');
    else if (conditionMasters.some((c) => c.code === form.code && c.id !== form.id)) errs.push('Condition Code must be unique (M1).');
    if (!form.name.trim()) errs.push('Condition Name is required.');
    if (!form.taxCode && form.gstTreatment !== 'EXEMPT' && form.gstTreatment !== 'NIL_RATED')
      errs.push(`${form.codeType} Code is required unless GST Treatment is Exempt / Nil-rated (M5).`);
    if (form.calcBasis === 'SLAB') {
      const sorted = [...form.slabTable].sort((a, b) => a.from - b.from);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].from >= sorted[i].to) errs.push(`Slab row ${i + 1}: "From" must be less than "To".`);
        if (i > 0 && sorted[i].from !== sorted[i - 1].to) errs.push('Slab ranges must be contiguous and non-overlapping (M4).');
      }
      if (sorted.length === 0) errs.push('At least one slab row is required when basis is Slab / scale.');
    }
    if (form.minValue != null && form.maxValue != null && form.minValue > form.maxValue) errs.push('Min Value cannot exceed Max Value.');
    if (form.autoConfirmOnMainGrn && !form.requiresServiceConfirmation)
      errs.push('Auto-confirm on main GRN requires Requires Service Confirmation to be enabled (M8).');
    return errs;
  };

  const handleSave = () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;
    upsertConditionMaster({
      ...form,
      gstRate: selectedTax?.gstRate,
      version: existing ? existing.version + 1 : 1,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={880}
      title={existing ? 'Edit PO Condition' : 'Add Custom PO Condition'}
      subtitle="Category is the master switch — it presets sign, vendor rules, capitalisation, and tax treatment. All presets stay overridable except sign for statutory/discount/deduction conditions."
      footer={
        <div className="flex items-center justify-between">
          <div className="text-[12px] text-slate-400">
            {existing ? `Version ${existing.version} → ${existing.version + 1} on save` : 'Version 1'}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary">
              {existing ? 'Save Changes' : 'Add Condition'}
            </button>
          </div>
        </div>
      }
    >
      {errors.length > 0 && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-rose-700">
            <AlertTriangle size={15} /> Fix the following before saving
          </div>
          <ul className="mt-1.5 list-disc pl-5 text-[12.5px] text-rose-600">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-8">
        {/* Section 1 — Identity */}
        <section>
          <div className="section-title mb-3">1 · Identity</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Condition Code" required hint="Stable machine key — used in integrations, reports, and audit. Immutable after first PO use.">
              <TextInput
                value={form.code}
                disabled={isCategoryLocked}
                onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="FRT-OCEAN"
                maxLength={20}
              />
            </Field>
            <Field label="Condition Name" required>
              <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ocean Freight" maxLength={100} />
            </Field>
            <Field label="Category" required hint={isCategoryLocked ? 'Locked — this condition is already used on a PO (M6).' : undefined}>
              <SelectInput
                value={form.category}
                disabled={isCategoryLocked}
                onChange={(v) => onCategoryChange(v as CategoryCode)}
                options={(Object.keys(CATEGORY_LABELS) as CategoryCode[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
              />
            </Field>
            <Field label="Sub-category" hint="Reporting rollup — drives spend analytics. Options are filtered by Category.">
              <SelectInput
                value={form.subCategory ?? ''}
                onChange={(v) => set('subCategory', v)}
                placeholder="Select sub-category"
                options={SUBCATEGORY_OPTIONS[form.category].map((s) => ({ value: s, label: s }))}
              />
            </Field>
            <Field label="Description" className="col-span-2">
              <TextArea rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Shown as helper text in the picker and printed on the PO PDF if enabled." />
            </Field>
            <Field label="Print on PO PDF">
              <Toggle checked={form.printOnPdf} onChange={(v) => set('printOnPdf', v)} />
            </Field>
          </div>
        </section>

        {/* Section 2 — Calculation */}
        <section>
          <div className="section-title mb-3">2 · Calculation</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Calculation Basis" required>
              <SelectInput
                value={form.calcBasis}
                onChange={(v) => set('calcBasis', v as CalculationBasis)}
                options={(Object.keys(CALC_BASIS_LABELS) as CalculationBasis[]).map((b) => ({ value: b, label: CALC_BASIS_LABELS[b] }))}
              />
            </Field>
            {showUom && (
              <Field label="UoM" hint="Must match the basis dimension (M3).">
                <SelectInput value={form.uomId ?? ''} onChange={(v) => set('uomId', v)} placeholder="Select UoM" options={uomOptions.map((u) => ({ value: u.id, label: u.name }))} />
              </Field>
            )}
            <Field label={CALC_BASIS_RATE_LABEL[form.calcBasis]} hint="A default — pre-fills the PO form, overridable if 5.9 permits.">
              <TextInput
                type="number"
                value={form.defaultRate ?? ''}
                onChange={(e) => set('defaultRate', e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder="0.00"
                disabled={form.calcBasis === 'SLAB'}
              />
            </Field>
            <Field label="Sign" required>
              <div className="flex h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded font-bold ${form.sign === '-' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {form.sign}
                </span>
                <span className="text-[12.5px] text-slate-500">
                  {isSignLocked ? `Locked by category (${CATEGORY_LABELS[form.category]})` : 'Editable for Other Charge / Pass-through'}
                </span>
                {!isSignLocked && (
                  <button
                    type="button"
                    onClick={() => set('sign', form.sign === '+' ? '-' : '+')}
                    className="ml-auto text-[12px] font-semibold text-indigo-brand"
                  >
                    Flip
                  </button>
                )}
              </div>
            </Field>
            <Field label="Currency" required>
              <SelectInput value={form.currency} onChange={(v) => set('currency', v)} options={[{ value: 'INR', label: 'INR — Indian Rupee' }, { value: 'USD', label: 'USD — US Dollar' }, { value: 'EUR', label: 'EUR — Euro' }]} />
            </Field>
            <Field label="Rounding Rule" required>
              <SelectInput
                value={form.rounding}
                onChange={(v) => set('rounding', v as ConditionMaster['rounding'])}
                options={[
                  { value: 'NORMAL', label: 'Normal — nearest whole unit' },
                  { value: 'UP', label: 'Round up' },
                  { value: 'DOWN', label: 'Round down' },
                  { value: 'NONE', label: 'None — keep decimals' },
                ]}
              />
            </Field>
            <Field label="Statistical" hint="If true, displays on the PO for visibility but does not affect PO total or vendor payable.">
              <Toggle checked={form.statistical} onChange={(v) => set('statistical', v)} />
            </Field>
          </div>
          {form.calcBasis === 'SLAB' && (
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[13px] font-bold text-slate-700">Slab Table</div>
                <button onClick={handleSlabAdd} className="flex items-center gap-1 text-[12.5px] font-semibold text-indigo-brand">
                  <Plus size={14} /> Add row
                </button>
              </div>
              <div className="space-y-2">
                {form.slabTable.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                    <TextInput type="number" value={row.from} onChange={(e) => handleSlabChange(row.id, 'from', Number(e.target.value))} placeholder="From" />
                    <TextInput type="number" value={row.to} onChange={(e) => handleSlabChange(row.id, 'to', Number(e.target.value))} placeholder="To" />
                    <TextInput type="number" value={row.rate} onChange={(e) => handleSlabChange(row.id, 'rate', Number(e.target.value))} placeholder="Rate %" />
                    <button onClick={() => handleSlabRemove(row.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {form.slabTable.length === 0 && <div className="text-[12.5px] text-slate-400">No slab rows yet.</div>}
              </div>
            </div>
          )}
        </section>

        {/* Section 3 — Tax */}
        <section>
          <div className="section-title mb-3">3 · Tax</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Code Type" required>
              <SelectInput value={form.codeType} onChange={(v) => set('codeType', v as ConditionMaster['codeType'])} options={[{ value: 'HSN', label: 'HSN — Goods' }, { value: 'SAC', label: 'SAC — Services' }]} />
            </Field>
            <Field label={`${form.codeType} Code`} required={form.gstTreatment !== 'EXEMPT' && form.gstTreatment !== 'NIL_RATED'}>
              <SelectInput value={form.taxCode ?? ''} onChange={(v) => set('taxCode', v)} placeholder={`Select ${form.codeType}`} options={taxOptions.map((t) => ({ value: t.code, label: `${t.code} — ${t.description}` }))} />
            </Field>
            <Field label="GST Rate" hint="Derived, read-only — looked up from the tax master. Override requires a reason and writes an audit entry.">
              <div className="flex items-center gap-2">
                <TextInput value={gstOverride ? undefined : `${selectedTax?.gstRate ?? '—'}%`} readOnly className="!bg-slate-100" />
                {gstOverride && <TextInput type="number" placeholder="Override %" className="!bg-amber-50" />}
                <button type="button" onClick={() => setGstOverride((v) => !v)} className="whitespace-nowrap text-[12px] font-semibold text-indigo-brand">
                  {gstOverride ? 'Cancel' : 'Override'}
                </button>
              </div>
            </Field>
            <Field label="GST Treatment" required>
              <SelectInput
                value={form.gstTreatment}
                onChange={(v) => set('gstTreatment', v as ConditionMaster['gstTreatment'])}
                options={Object.entries(GST_TREATMENT_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            {form.gstTreatment === 'DEDUCTIBLE' && (
              <Field label="ITC Eligibility %" hint="Supports partial credit where the business makes both taxable and exempt supplies.">
                <TextInput type="number" min={0} max={100} value={form.itcEligibilityPct} onChange={(e) => set('itcEligibilityPct', Number(e.target.value))} />
              </Field>
            )}
            <Field label="Tax calculated on" required>
              <SelectInput
                value={form.taxCalculatedOn}
                onChange={(v) => set('taxCalculatedOn', v as ConditionMaster['taxCalculatedOn'])}
                options={[{ value: 'CONDITION_AMOUNT', label: 'Condition amount' }, { value: 'CONDITION_PLUS_SELECTED', label: 'Condition + selected conditions' }]}
              />
            </Field>
            <Field label="TDS applicable">
              <Toggle checked={form.tdsApplicable} onChange={(v) => set('tdsApplicable', v)} />
            </Field>
            {form.tdsApplicable && (
              <Field label="TDS Section">
                <TextInput value={form.tdsSection ?? ''} onChange={(e) => set('tdsSection', e.target.value)} placeholder="194Q" />
              </Field>
            )}
          </div>
        </section>

        {/* Section 4 — Vendor & Ownership */}
        <section>
          <div className="section-title mb-3">4 · Vendor & Ownership</div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Default Vendor">
              <SelectInput value={form.defaultVendorId ?? ''} onChange={(v) => set('defaultVendorId', v)} placeholder="None" options={VENDORS.map((v) => ({ value: v.id, label: v.name }))} />
            </Field>
            <Field label="Vendor Rule" required hint={CATEGORY_PRESETS[form.category].vendorRule !== 'EITHER' ? 'Preset by category — enforced as a hard validation at PO save (P1/P2).' : undefined}>
              <SelectInput
                value={form.vendorRule}
                disabled={form.category === 'DISC' || form.category === 'DEDN'}
                onChange={(v) => set('vendorRule', v as ConditionMaster['vendorRule'])}
                options={Object.entries(VENDOR_RULE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Vendor Group filter" className="col-span-2" hint="Restricts the vendor picker on the PO form.">
              <MultiChipSelect value={form.vendorGroupFilter} onChange={(v) => set('vendorGroupFilter', v)} options={VENDOR_GROUPS.map((g) => ({ value: g, label: g }))} />
            </Field>
            <Field label="Default Condition Invoice Owner">
              <TextInput value={form.defaultInvoiceOwner ?? ''} onChange={(e) => set('defaultInvoiceOwner', e.target.value)} placeholder="e.g. Logistics Desk" />
            </Field>
            <Field label={form.requiresServiceConfirmation ? 'Service Confirmation Owner' : 'Default Condition GRN Owner'}>
              <TextInput value={form.defaultConfirmationOwner ?? ''} onChange={(e) => set('defaultConfirmationOwner', e.target.value)} placeholder="e.g. Warehouse Team" />
            </Field>
          </div>
        </section>

        {/* Section 5 — Advanced Settings */}
        <Accordion title="5 · Advanced Settings" subtitle="Sequence, cascade, capitalisation, confirmation & applicability rules">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sequence No." required hint="Execution order — conditions evaluate ascending. Gaps of 10 allow later insertion.">
                <TextInput type="number" step={10} value={form.sequence} onChange={(e) => set('sequence', Number(e.target.value))} />
              </Field>
              <Field label="Calculate On" required>
                <SelectInput
                  value={form.calculateOn}
                  onChange={(v) => set('calculateOn', v as ConditionMaster['calculateOn'])}
                  options={[{ value: 'LINE_BASE', label: 'Line base value' }, { value: 'SELECTED', label: 'Line base + selected conditions' }]}
                />
              </Field>
              {form.calculateOn === 'SELECTED' && (
                <Field label="Selected steps" className="col-span-2" hint="Only lower-sequence condition codes are selectable — prevents circular references (M2). Include “BASE” to add the line base value into the chain.">
                  <MultiChipSelect
                    value={form.calculateOnCodes}
                    onChange={(v) => set('calculateOnCodes', v)}
                    options={[{ value: BASE_STEP, label: 'BASE (line value)' }, ...lowerSequenceCodes]}
                  />
                </Field>
              )}
              <Field label="Include in Item Landed Cost">
                <Toggle checked={form.capitalise} onChange={(v) => set('capitalise', v)} />
              </Field>
              <Field label="Allowed Level" required>
                <SelectInput
                  value={form.allowedLevel}
                  onChange={(v) => set('allowedLevel', v as ConditionMaster['allowedLevel'])}
                  options={[{ value: 'LINE', label: 'Line only' }, { value: 'HEADER', label: 'Header only' }, { value: 'BOTH', label: 'Both' }]}
                />
              </Field>
              {form.allowedLevel !== 'LINE' && (
                <Field label="Distribution Basis" hint="How a header condition explodes across lines. Wrong basis produces wrong landed cost.">
                  <SelectInput
                    value={form.distributionBasis ?? 'VALUE'}
                    onChange={(v) => set('distributionBasis', v as ConditionMaster['distributionBasis'])}
                    options={Object.entries(DISTRIBUTION_LABELS).map(([value, label]) => ({ value, label }))}
                  />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Requires Service Confirmation">
                <Toggle checked={form.requiresServiceConfirmation} onChange={(v) => set('requiresServiceConfirmation', v)} />
              </Field>
              {form.requiresServiceConfirmation && (
                <>
                  <Field label="Auto-confirm on main GRN" hint="Goods arriving is proof the freight was rendered.">
                    <Toggle checked={form.autoConfirmOnMainGrn} onChange={(v) => set('autoConfirmOnMainGrn', v)} />
                  </Field>
                  <Field label="Confirmation on partial GRN">
                    <SelectInput
                      value={form.confirmationOnPartialGrn}
                      onChange={(v) => set('confirmationOnPartialGrn', v as ConditionMaster['confirmationOnPartialGrn'])}
                      options={[{ value: 'PROPORTIONAL', label: 'Proportional' }, { value: 'FULL_ON_FIRST_GRN', label: 'Full on first GRN' }]}
                    />
                  </Field>
                </>
              )}
              <Field label="Rate editable on PO">
                <Toggle checked={form.rateEditableOnPo} onChange={(v) => set('rateEditableOnPo', v)} />
              </Field>
              <Field label="Vendor editable on PO">
                <Toggle checked={form.vendorEditableOnPo} onChange={(v) => set('vendorEditableOnPo', v)} />
              </Field>
              <Field label="Requires attachment">
                <Toggle checked={form.requiresAttachment} onChange={(v) => set('requiresAttachment', v)} />
              </Field>
              <Field label="Reversible / Refundable">
                <Toggle checked={form.reversible} onChange={(v) => set('reversible', v)} />
              </Field>
              {form.reversible && (
                <Field label="Release trigger">
                  <SelectInput
                    value={form.releaseTrigger ?? 'MANUAL'}
                    onChange={(v) => set('releaseTrigger', v as ConditionMaster['releaseTrigger'])}
                    options={[{ value: 'MANUAL', label: 'Manual' }, { value: 'WARRANTY_EXPIRY', label: 'On warranty expiry' }, { value: 'COMMISSIONING', label: 'On commissioning' }, { value: 'ON_DATE', label: 'On date' }]}
                  />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Min Value">
                <TextInput type="number" value={form.minValue ?? ''} onChange={(e) => set('minValue', e.target.value === '' ? undefined : Number(e.target.value))} />
              </Field>
              <Field label="Max Value">
                <TextInput type="number" value={form.maxValue ?? ''} onChange={(e) => set('maxValue', e.target.value === '' ? undefined : Number(e.target.value))} />
              </Field>
              <Field label="Approval threshold">
                <TextInput type="number" value={form.approvalThreshold ?? ''} onChange={(e) => set('approvalThreshold', e.target.value === '' ? undefined : Number(e.target.value))} />
              </Field>
            </div>

            {form.calcBasis === 'SLAB' && (
              <div className="grid grid-cols-3 gap-4">
                <Field label="Index reference">
                  <SelectInput value={form.indexReferenceId ?? ''} onChange={(v) => set('indexReferenceId', v)} placeholder="None" options={INDEX_MASTER.map((i) => ({ value: i.id, label: i.name }))} />
                </Field>
                {form.indexReferenceId && (
                  <>
                    <Field label="Revision frequency">
                      <SelectInput value={form.indexRevisionFrequency ?? 'Monthly'} onChange={(v) => set('indexRevisionFrequency', v)} options={[{ value: 'Monthly', label: 'Monthly' }, { value: 'Quarterly', label: 'Quarterly' }]} />
                    </Field>
                    <Field label="Revision lag (months)">
                      <TextInput type="number" value={form.indexRevisionLag ?? 1} onChange={(e) => set('indexRevisionLag', Number(e.target.value))} />
                    </Field>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Applicability — Entities" hint="Blank = all.">
                <MultiChipSelect value={form.applicabilityEntities} onChange={(v) => set('applicabilityEntities', v)} options={ENTITIES.map((e) => ({ value: e.id, label: e.name }))} />
              </Field>
              <Field label="Applicability — Categories">
                <MultiChipSelect value={form.applicabilityCategories} onChange={(v) => set('applicabilityCategories', v)} options={SPEND_CATEGORIES.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label="Applicability — Vendors">
                <MultiChipSelect value={form.applicabilityVendors} onChange={(v) => set('applicabilityVendors', v)} options={VENDORS.map((v) => ({ value: v.id, label: v.name }))} />
              </Field>
              <Field label="Mandatory for" hint="Forces the condition onto the PO for these Incoterms/categories.">
                <MultiChipSelect value={form.mandatoryFor} onChange={(v) => set('mandatoryFor', v)} options={INCOTERMS.map((t) => ({ value: t, label: t }))} />
              </Field>
              <Field label="Mutually exclusive with" className="col-span-2">
                <MultiChipSelect
                  value={form.mutuallyExclusiveWith}
                  onChange={(v) => set('mutuallyExclusiveWith', v)}
                  options={conditionMasters.filter((c) => c.id !== form.id).map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Valid From" required>
                <TextInput type="date" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
              </Field>
              <Field label="Valid To">
                <TextInput type="date" value={form.validTo ?? ''} onChange={(e) => set('validTo', e.target.value)} />
              </Field>
              <Field label="Status" required>
                <SelectInput value={form.status} onChange={(v) => set('status', v as ConditionMaster['status'])} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
              </Field>
            </div>
          </div>
        </Accordion>
      </div>
    </Modal>
  );
}
