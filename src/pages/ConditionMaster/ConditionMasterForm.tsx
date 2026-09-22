import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Field, TextInput, TextArea, SelectInput, Toggle, Accordion, MultiChipSelect } from '../../components/ui/Form';
import { useData } from '../../context/DataContext';
import { CATEGORY_PRESETS } from '../../data/categoryPresets';
import { SUBCATEGORY_OPTIONS } from '../../data/subcategories';
import { TAX_MASTER, UOMS, VENDORS, ENTITIES, INDEX_MASTER } from '../../data/seed';
import { BASE_STEP, detectCircularDependency } from '../../engine/calc';
import { PO_RULE_FIELDS, LINE_RULE_FIELDS, ruleFieldKey } from '../../engine/ruleFields';
import { uid } from '../../data/ids';
import {
  CATEGORY_LABELS,
  CALC_BASIS_LABELS,
  CALC_BASIS_RATE_LABEL,
  GST_TREATMENT_LABELS,
  VENDOR_RULE_LABELS,
  DISTRIBUTION_LABELS,
  CALCULATION_MODE_LABELS,
  FORMULA_TYPE_LABELS,
  COMPARISON_OPERATOR_LABELS,
  SLAB_BASIS_LABELS,
  CUMULATIVE_BASIS_LABELS,
  CUMULATIVE_SCOPE_LABELS,
  type CategoryCode,
  type CalculationBasis,
  type ConditionMaster,
  type SlabRow,
  type CalculationMode,
  type CalculationRule,
  type FormulaRule,
  type FormulaType,
  type SelectedStep,
  type RuleClause,
  type RuleField,
  type ComparisonOperator,
  type SlabTier,
  type SlabBasis,
  type CumulativeBasis,
  type CumulativeScope,
} from '../../types';
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react';

const SPEND_CATEGORIES = ['Batteries', 'Electronics', 'Fabrication', 'Packaging Material', 'MRO', 'Petroleum'];
const INCOTERMS = ['EXW', 'FOB', 'CIF', 'CFR', 'DAP', 'DDP'];
const VENDOR_GROUPS = Array.from(new Set(VENDORS.map((v) => v.vendorGroup)));

const FORMULA_TYPE_FOR_CALC_BASIS: Record<CalculationBasis, FormulaType> = {
  FIXED_PER_PO: 'FIXED',
  FIXED_PER_LINE: 'FIXED',
  RATE_X_QTY: 'RATE_X_QTY',
  PCT_OF_LINE_BASE: 'PERCENTAGE',
  PCT_OF_SELECTED_BASE: 'PERCENTAGE',
  RATE_X_WEIGHT: 'RATE_X_WEIGHT',
  RATE_X_VOLUME: 'RATE_X_VOLUME',
  SLAB: 'FIXED',
};

function defaultRuleFor(mode: CalculationMode, seedCalcBasis?: CalculationBasis, seedRate?: number, seedUomId?: string): CalculationRule {
  switch (mode) {
    case 'BASE':
      return { mode: 'BASE', base: { type: seedCalcBasis ? FORMULA_TYPE_FOR_CALC_BASIS[seedCalcBasis] : 'PERCENTAGE', value: seedRate ?? 0, uomId: seedUomId } };
    case 'DIRECT':
      return { mode: 'DIRECT', direct: { type: 'PERCENTAGE', value: 0 } };
    case 'SELECTED_CONDITIONS':
      return { mode: 'SELECTED_CONDITIONS', selected: { steps: [{ operator: '+', source: 'BASE', valueKind: 'CONDITION_AMOUNT', percentage: 100 }] } };
    case 'CONDITIONAL':
      return {
        mode: 'CONDITIONAL',
        conditional: {
          clauses: [{ field: { source: 'PO', field: 'baseAmount' }, operator: '>', value: 0 }],
          then: { type: 'PERCENTAGE', value: 0 },
          else: { type: 'PERCENTAGE', value: 0 },
        },
      };
    case 'SLAB':
      return { mode: 'SLAB', slab: { basis: 'QUANTITY', tiers: [] } };
    case 'CUMULATIVE':
      return { mode: 'CUMULATIVE', cumulative: { basis: 'QUANTITY', scope: 'VENDOR', tiers: [] } };
  }
}

// Reads a legacy record (Calculate-On/CalcBasis, saved before this rule model existed) as an
// equivalent CalculationMode + CalculationRule, so opening an old Condition Master in this form
// shows a pre-filled rule builder instead of a blank one — the "migrate old representation"
// requirement (CALCULATION_ENGINE.md-adjacent, see §19 of the redesign brief). Saving the form
// afterwards persists calculationMode/calculationRule, so the record only needs migrating once.
function deriveRuleFromLegacy(m: ConditionMaster): { calculationMode: CalculationMode; calculationRule: CalculationRule } {
  if (m.calcBasis === 'SLAB') {
    return {
      calculationMode: 'SLAB',
      calculationRule: {
        mode: 'SLAB',
        slab: { basis: 'QUANTITY', tiers: m.slabTable.map((r) => ({ id: r.id, from: r.from, to: r.to, rateType: 'PERCENTAGE', rate: r.rate })) },
      },
    };
  }
  if (m.calculateOn === 'SELECTED') {
    const codes = m.calculateOnCodes.length ? m.calculateOnCodes : [BASE_STEP];
    const weights = m.calculateOnWeights ?? {};
    return {
      calculationMode: 'SELECTED_CONDITIONS',
      calculationRule: {
        mode: 'SELECTED_CONDITIONS',
        selected: {
          steps: codes.map((code) => ({
            operator: '+',
            source: code === BASE_STEP ? 'BASE' : 'CONDITION',
            conditionCode: code === BASE_STEP ? undefined : code,
            valueKind: 'CONDITION_AMOUNT',
            percentage: weights[code] ?? 100,
          })),
        },
      },
    };
  }
  return {
    calculationMode: 'BASE',
    calculationRule: { mode: 'BASE', base: { type: FORMULA_TYPE_FOR_CALC_BASIS[m.calcBasis], value: m.defaultRate ?? 0, uomId: m.uomId } },
  };
}

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
    calculationMode: 'BASE',
    calculationRule: defaultRuleFor('BASE', preset.calcBasis),
    calculateOn: 'LINE_BASE',
    calculateOnCodes: [],
    calculateOnWeights: {},
    slabTable: [],
    minChargeAmount: undefined,
    maxChargeAmount: undefined,
    capitalise: preset.capitalise!,
    allowedLevel: preset.allowedLevel!,
    distributionBasis: 'VALUE',
    requiresServiceConfirmation: preset.requiresServiceConfirmation!,
    autoConfirmOnMainGrn: false,
    confirmationOnPartialGrn: 'PROPORTIONAL',
    lineItemGrnRequired: preset.lineItemGrnRequired!,
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
  const [form, setForm] = useState<ConditionMaster>(() => {
    if (!existing) return emptyCondition();
    if (existing.calculationMode && existing.calculationRule) return { ...existing };
    return { ...existing, ...deriveRuleFromLegacy(existing) };
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [gstOverride, setGstOverride] = useState(false);
  const [minMaxChargeOpen, setMinMaxChargeOpen] = useState(!!(existing?.minChargeAmount != null || existing?.maxChargeAmount != null));

  const set = <K extends keyof ConditionMaster>(key: K, value: ConditionMaster[K]) => setForm((f) => ({ ...f, [key]: value }));

  const setCalcMode = (mode: CalculationMode) => {
    setForm((f) => ({ ...f, calculationMode: mode, calculationRule: defaultRuleFor(mode, f.calcBasis, f.defaultRate, f.uomId) }));
  };
  const setRule = (rule: CalculationRule) => setForm((f) => ({ ...f, calculationRule: rule }));

  const onCategoryChange = (category: CategoryCode) => {
    const preset = CATEGORY_PRESETS[category];
    const mode: CalculationMode = preset.calculateOn === 'SELECTED' ? 'SELECTED_CONDITIONS' : 'BASE';
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
      lineItemGrnRequired: preset.lineItemGrnRequired!,
      rateEditableOnPo: preset.rateEditableOnPo!,
      allowedLevel: preset.allowedLevel!,
      calculateOn: preset.calculateOn ?? 'LINE_BASE',
      calculationMode: mode,
      calculationRule: defaultRuleFor(mode, preset.calcBasis),
    }));
  };

  // No Sequence No. any more — every OTHER active condition is a selectable reference.
  // A cycle this would create (A -> B -> A) is caught at save time (validate()), not by
  // restricting the list up front.
  const otherConditionOptions = useMemo(
    () => conditionMasters.filter((c) => c.id !== form.id && c.status === 'Active').map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` })),
    [conditionMasters, form.id]
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
  const allUomOptions = UOMS.map((u) => ({ value: u.id, label: u.name }));

  const isCategoryLocked = form.usedOnAnyPo;
  const isSignLocked = CATEGORY_PRESETS[form.category].signLocked;

  // Only SELECTED_CONDITIONS still uses §2's Calculation Basis + Rate to turn its computed
  // base into an amount (the split the redesign brief's §4 describes: base from the rule
  // builder below, amount = that base x this rate). Every other mode is a self-contained
  // formula and doesn't need §2's basis/rate/UoM/slab fields at all.
  const showLegacyBasisFields = form.calculationMode === 'SELECTED_CONDITIONS';

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.code.trim()) errs.push('Condition Code is required.');
    else if (!/^[A-Z0-9-]{1,20}$/.test(form.code)) errs.push('Condition Code must be uppercase alphanumeric + hyphen, max 20 chars.');
    else if (conditionMasters.some((c) => c.code === form.code && c.id !== form.id)) errs.push('Condition Code must be unique (M1).');
    if (!form.name.trim()) errs.push('Condition Name is required.');
    if (!form.taxCode && form.gstTreatment !== 'EXEMPT' && form.gstTreatment !== 'NIL_RATED')
      errs.push(`${form.codeType} Code is required unless GST Treatment is Exempt / Nil-rated (M5).`);

    if (showLegacyBasisFields && form.calcBasis === 'SLAB') {
      const sorted = [...form.slabTable].sort((a, b) => a.from - b.from);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].from >= sorted[i].to) errs.push(`Slab row ${i + 1}: "From" must be less than "To".`);
        if (i > 0 && sorted[i].from !== sorted[i - 1].to) errs.push('Slab ranges must be contiguous and non-overlapping (M4).');
      }
      if (sorted.length === 0) errs.push('At least one slab row is required when basis is Slab / scale.');
    }
    if (form.minValue != null && form.maxValue != null && form.minValue > form.maxValue) errs.push('Min Value cannot exceed Max Value.');
    if (form.minChargeAmount != null && form.maxChargeAmount != null && form.minChargeAmount > form.maxChargeAmount)
      errs.push('Minimum Calculated Amount cannot exceed Maximum Calculated Amount.');
    if (form.autoConfirmOnMainGrn && !form.requiresServiceConfirmation)
      errs.push('Auto-confirm on main GRN requires Requires Service Confirmation to be enabled (M8).');

    // Rule-specific validation
    const rule = form.calculationRule;
    if (rule?.mode === 'SELECTED_CONDITIONS') {
      if (rule.selected.steps.length === 0) errs.push('Add at least one step to the Selected Conditions formula.');
      rule.selected.steps.forEach((s) => {
        if (s.source === 'CONDITION') {
          if (!s.conditionCode) errs.push('Every Selected Conditions step must reference a condition.');
          else if (s.conditionCode === form.code) errs.push('A condition cannot depend on itself — remove the self-reference.');
          else if (!conditionMasters.some((c) => c.code === s.conditionCode)) errs.push(`Referenced condition "${s.conditionCode}" does not exist.`);
          else if (conditionMasters.find((c) => c.code === s.conditionCode)?.status === 'Inactive')
            errs.push(`Referenced condition "${s.conditionCode}" is inactive.`);
        }
      });
    }
    if (rule?.mode === 'CONDITIONAL') {
      if (rule.conditional.clauses.length === 0) errs.push('Add at least one IF clause to the Conditional Rule.');
      rule.conditional.clauses.forEach((c) => {
        if (c.field.source === 'CONDITION' && c.field.field === form.code) errs.push('A condition cannot reference itself in its own IF clause.');
        if (!['IS_EMPTY', 'IS_NOT_EMPTY'].includes(c.operator) && (c.value === undefined || c.value === '')) errs.push('Every IF clause needs a comparison value (unless the operator is IS EMPTY / IS NOT EMPTY).');
      });
      if (!rule.conditional.then) errs.push('A THEN calculation is required.');
    }
    if (rule?.mode === 'SLAB') {
      const sorted = [...rule.slab.tiers].sort((a, b) => a.from - b.from);
      if (sorted.length === 0) errs.push('Add at least one slab tier.');
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].to != null && sorted[i].from >= sorted[i].to!) errs.push(`Slab tier ${i + 1}: "From" must be less than "To".`);
        if (i > 0 && sorted[i].from < sorted[i - 1].to!) errs.push('Slab tiers must not overlap.');
        if (i < sorted.length - 1 && sorted[i].to == null) errs.push('Only the last slab tier may be open-ended.');
      }
    }
    if (rule?.mode === 'CUMULATIVE' && rule.cumulative.tiers.length === 0) errs.push('Add at least one cumulative tier.');

    // Circular-dependency check across the whole Condition Master set (replaces the old
    // "only lower-sequence codes selectable" guard now that there's no sequence to compare).
    if (form.code.trim()) {
      const candidate = { code: form.code, calculationMode: form.calculationMode, calculationRule: form.calculationRule, calculateOn: form.calculateOn, calculateOnCodes: form.calculateOnCodes };
      const others = conditionMasters.filter((c) => c.id !== form.id).map((c) => ({ code: c.code, calculationMode: c.calculationMode, calculationRule: c.calculationRule, calculateOn: c.calculateOn, calculateOnCodes: c.calculateOnCodes }));
      const cycleMsg = detectCircularDependency(candidate, others);
      if (cycleMsg) errs.push(cycleMsg);
    }

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

        {/* Section 2 — Calculation (basis/rate only meaningful for Selected Conditions mode — see §5) */}
        <section>
          <div className="section-title mb-3">2 · Calculation</div>
          {showLegacyBasisFields && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Calculation Basis" required hint="How the Calculate-On base below (§5) becomes this condition's amount.">
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
                />
              </Field>
            </div>
          )}
          {!showLegacyBasisFields && (
            <div className="rounded-lg border border-dashed border-slate-200 px-3.5 py-2.5 text-[12px] text-slate-400">
              Fully determined by the Calculate On formula in §5 Advanced Settings — no separate basis/rate needed for this mode.
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-4">
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
          {showLegacyBasisFields && form.calcBasis === 'SLAB' && (
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[13px] font-bold text-slate-700">Legacy Slab Table</div>
                <button
                  onClick={() => set('slabTable', [...form.slabTable, { id: uid('slab'), from: form.slabTable.at(-1)?.to ?? 0, to: (form.slabTable.at(-1)?.to ?? 0) + 50000, rate: 1 }])}
                  className="flex items-center gap-1 text-[12.5px] font-semibold text-indigo-brand"
                >
                  <Plus size={14} /> Add row
                </button>
              </div>
              <div className="space-y-2">
                {form.slabTable.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                    <TextInput type="number" value={row.from} onChange={(e) => set('slabTable', form.slabTable.map((r) => (r.id === row.id ? { ...r, from: Number(e.target.value) } : r)))} placeholder="From" />
                    <TextInput type="number" value={row.to} onChange={(e) => set('slabTable', form.slabTable.map((r) => (r.id === row.id ? { ...r, to: Number(e.target.value) } : r)))} placeholder="To" />
                    <TextInput type="number" value={row.rate} onChange={(e) => set('slabTable', form.slabTable.map((r) => (r.id === row.id ? { ...r, rate: Number(e.target.value) } : r) as SlabRow))} placeholder="Rate %" />
                    <button onClick={() => set('slabTable', form.slabTable.filter((r) => r.id !== row.id))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {form.slabTable.length === 0 && <div className="text-[12.5px] text-slate-400">No slab rows yet — this condition predates the Slab / Tier mode in §5; switch Calculate On to "Slab / Tier" to use the new builder instead.</div>}
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
            <Field label="Tax calculated on" required hint="Same dependency engine as every condition — 'Condition + selected' cascades GST onto whichever conditions this one's rule already references.">
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
        <Accordion title="5 · Advanced Settings" subtitle="Calculate-On rule, capitalisation, confirmation & applicability rules">
          <div className="space-y-6">
            <div>
              <Field
                label="Calculate On"
                required
                hint="No Sequence No. — calculation order is derived automatically from which conditions this rule references."
              >
                <SelectInput
                  value={form.calculationMode ?? 'BASE'}
                  onChange={(v) => setCalcMode(v as CalculationMode)}
                  options={(Object.keys(CALCULATION_MODE_LABELS) as CalculationMode[]).map((m) => ({ value: m, label: CALCULATION_MODE_LABELS[m] }))}
                />
              </Field>

              <div className="mt-3">
                {form.calculationRule?.mode === 'BASE' && (
                  <FormulaRuleBuilder value={form.calculationRule.base} uomOptions={allUomOptions} onChange={(f) => setRule({ mode: 'BASE', base: f })} previewLabel="Condition" />
                )}
                {form.calculationRule?.mode === 'DIRECT' && (
                  <FormulaRuleBuilder value={form.calculationRule.direct} uomOptions={allUomOptions} onChange={(f) => setRule({ mode: 'DIRECT', direct: f })} previewLabel="Condition" />
                )}
                {form.calculationRule?.mode === 'SELECTED_CONDITIONS' && (
                  <SelectedConditionsBuilder
                    steps={form.calculationRule.selected.steps}
                    options={[{ value: BASE_STEP, label: 'BASE (line value)' }, ...otherConditionOptions]}
                    onChange={(steps) => setRule({ mode: 'SELECTED_CONDITIONS', selected: { steps } })}
                  />
                )}
                {form.calculationRule?.mode === 'CONDITIONAL' && (
                  <ConditionalRuleBuilder
                    rule={form.calculationRule.conditional}
                    conditionOptions={otherConditionOptions}
                    uomOptions={allUomOptions}
                    onChange={(conditional) => setRule({ mode: 'CONDITIONAL', conditional })}
                  />
                )}
                {form.calculationRule?.mode === 'SLAB' && (
                  <SlabRuleBuilder rule={form.calculationRule.slab} onChange={(slab) => setRule({ mode: 'SLAB', slab })} />
                )}
                {form.calculationRule?.mode === 'CUMULATIVE' && (
                  <CumulativeRuleBuilder rule={form.calculationRule.cumulative} onChange={(cumulative) => setRule({ mode: 'CUMULATIVE', cumulative })} />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[13px] font-bold text-slate-700">Minimum / Maximum Calculated Amount</div>
                <Toggle checked={minMaxChargeOpen} onChange={(v) => { setMinMaxChargeOpen(v); if (!v) { set('minChargeAmount', undefined); set('maxChargeAmount', undefined); } }} />
              </div>
              {minMaxChargeOpen && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Minimum Calculated Amount" hint="Clamps the raw result up to this floor before sign/rounding — e.g. a 2% fee that's never less than ₹5,000.">
                    <TextInput type="number" value={form.minChargeAmount ?? ''} onChange={(e) => set('minChargeAmount', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="₹" />
                  </Field>
                  <Field label="Maximum Calculated Amount" hint="Clamps the raw result down to this ceiling before sign/rounding.">
                    <TextInput type="number" value={form.maxChargeAmount ?? ''} onChange={(e) => set('maxChargeAmount', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="₹" />
                  </Field>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Requires Service Confirmation">
                <Toggle checked={form.requiresServiceConfirmation} onChange={(v) => set('requiresServiceConfirmation', v)} />
              </Field>
              {form.requiresServiceConfirmation && (
                <Field label="Auto-confirm on main GRN" hint="Goods arriving is proof the freight was rendered.">
                  <Toggle checked={form.autoConfirmOnMainGrn} onChange={(v) => set('autoConfirmOnMainGrn', v)} />
                </Field>
              )}
              <Field label="Line Item GRN Required" hint="When on, a GRN for this condition can only be created after the underlying item GRN.">
                <Toggle checked={form.lineItemGrnRequired} onChange={(v) => set('lineItemGrnRequired', v)} />
              </Field>
              {form.lineItemGrnRequired && (
                <Field label="Confirmation on partial GRN" hint="How the condition amount is calculated when the item GRN is partial.">
                  <SelectInput
                    value={form.confirmationOnPartialGrn}
                    onChange={(v) => set('confirmationOnPartialGrn', v as ConditionMaster['confirmationOnPartialGrn'])}
                    options={[{ value: 'PROPORTIONAL', label: 'Proportional' }, { value: 'FULL_ON_FIRST_GRN', label: 'Full on first GRN' }]}
                  />
                </Field>
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
              <Field label="Min Value" hint="Validates the RATE entered on the PO form — different from Minimum Calculated Amount above, which clamps the result.">
                <TextInput type="number" value={form.minValue ?? ''} onChange={(e) => set('minValue', e.target.value === '' ? undefined : Number(e.target.value))} />
              </Field>
              <Field label="Max Value">
                <TextInput type="number" value={form.maxValue ?? ''} onChange={(e) => set('maxValue', e.target.value === '' ? undefined : Number(e.target.value))} />
              </Field>
              <Field label="Approval threshold">
                <TextInput type="number" value={form.approvalThreshold ?? ''} onChange={(e) => set('approvalThreshold', e.target.value === '' ? undefined : Number(e.target.value))} />
              </Field>
            </div>

            {showLegacyBasisFields && form.calcBasis === 'SLAB' && (
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
              <Field label="Mutually exclusive with" className="col-span-2" hint="Whether this condition can be added at all — separate from how it's calculated above (§5).">
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

function formulaPreview(f: FormulaRule): string {
  switch (f.type) {
    case 'PERCENTAGE':
      return `${f.value}% of Base`;
    case 'FIXED':
      return `₹${f.value.toLocaleString('en-IN')} Fixed`;
    case 'RATE_X_QTY':
      return `₹${f.value} × Quantity`;
    case 'RATE_X_WEIGHT':
      return `₹${f.value} × Weight (KG)`;
    case 'RATE_X_VOLUME':
      return `₹${f.value} × Volume (CBM)`;
  }
}

// Modes 1 (Base) & 3 (Direct Calculation) share this builder — both are a single
// self-contained formula (Percentage / Fixed / Rate x Qty / Weight / Volume); the
// redesign brief lists their capabilities identically. THEN/ELSE branches of a
// CONDITIONAL rule reuse it too, so "IF... THEN 2% of Base" stays one formula shape.
function FormulaRuleBuilder({
  value,
  uomOptions,
  onChange,
  previewLabel,
}: {
  value: FormulaRule;
  uomOptions: { value: string; label: string }[];
  onChange: (f: FormulaRule) => void;
  previewLabel: string;
}) {
  const showUom = value.type === 'RATE_X_QTY' || value.type === 'RATE_X_WEIGHT' || value.type === 'RATE_X_VOLUME';
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3.5">
      <div className={`grid gap-3 ${showUom ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <SelectInput
          value={value.type}
          onChange={(v) => onChange({ ...value, type: v as FormulaRule['type'] })}
          options={(Object.keys(FORMULA_TYPE_LABELS) as FormulaRule['type'][]).map((t) => ({ value: t, label: FORMULA_TYPE_LABELS[t] }))}
        />
        <TextInput type="number" value={value.value} onChange={(e) => onChange({ ...value, value: Number(e.target.value) })} placeholder="Value" />
        {showUom && <SelectInput value={value.uomId ?? ''} onChange={(v) => onChange({ ...value, uomId: v })} placeholder="UoM" options={uomOptions} />}
      </div>
      <div className="rounded-lg bg-indigo-50/70 px-2.5 py-1.5 font-mono text-[11.5px] text-indigo-700">
        {previewLabel} = {formulaPreview(value)}
      </div>
    </div>
  );
}

// Mode 2 — Selected Conditions: the weighted-sum "Calculate On" builder, now with a
// +/- operator per step and a choice of which value of a referenced condition to use
// (its final calculated amount by default, or its own calc base). "A condition must use
// its FINAL CALCULATED AMOUNT, not its configured rate" is enforced by construction here:
// there's no option that reads a rate — only CONDITION_AMOUNT / CONDITION_BASE, both
// runtime outputs the engine resolves from ctx.priorAmounts/priorBases (engine/calc.ts).
function SelectedConditionsBuilder({
  steps,
  options,
  onChange,
}: {
  steps: SelectedStep[];
  options: { value: string; label: string }[];
  onChange: (steps: SelectedStep[]) => void;
}) {
  const labelFor = (code?: string) => (code === BASE_STEP || !code ? 'Base' : options.find((o) => o.value === code)?.label.split(' — ')[0] ?? code);
  const usedCodes = new Set(steps.map((s) => (s.source === 'BASE' ? BASE_STEP : s.conditionCode)));
  const availableToAdd = options.filter((o) => !usedCodes.has(o.value));

  const addStep = (code: string) => {
    if (!code) return;
    const next: SelectedStep = code === BASE_STEP
      ? { operator: '+', source: 'BASE', valueKind: 'CONDITION_AMOUNT', percentage: 100 }
      : { operator: '+', source: 'CONDITION', conditionCode: code, valueKind: 'CONDITION_AMOUNT', percentage: 100 };
    onChange([...steps, next]);
  };
  const removeStep = (i: number) => onChange(steps.filter((_, idx) => idx !== i));
  const updateStep = (i: number, patch: Partial<SelectedStep>) => onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center">
            {i > 0 && (
              <button
                type="button"
                onClick={() => updateStep(i, { operator: s.operator === '+' ? '-' : '+' })}
                className="mr-2 w-4 text-center text-[13px] font-bold text-slate-400 hover:text-indigo-brand"
                title="Toggle + / -"
              >
                {s.operator}
              </button>
            )}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1.5">
              <input
                type="number"
                min={0}
                value={s.percentage}
                onChange={(e) => updateStep(i, { percentage: Math.max(0, Number(e.target.value)) })}
                className="w-10 bg-transparent text-right text-[12.5px] font-semibold text-indigo-brand outline-none"
              />
              <span className="text-[11px] text-slate-400">% of</span>
              <span className="text-[12.5px] font-semibold text-slate-700">{labelFor(s.source === 'BASE' ? BASE_STEP : s.conditionCode)}</span>
              {s.source === 'CONDITION' && (
                <select
                  value={s.valueKind ?? 'CONDITION_AMOUNT'}
                  onChange={(e) => updateStep(i, { valueKind: e.target.value as SelectedStep['valueKind'] })}
                  className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10.5px] text-slate-500 outline-none"
                >
                  <option value="CONDITION_AMOUNT">Amount</option>
                  <option value="CONDITION_BASE">Base</option>
                </select>
              )}
              <button type="button" onClick={() => removeStep(i)} className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
        {availableToAdd.length > 0 && (
          <select
            value=""
            onChange={(e) => addStep(e.target.value)}
            className="rounded-lg border border-dashed border-slate-300 bg-white px-2 py-1.5 text-[12px] font-semibold text-indigo-brand outline-none"
          >
            <option value="">{steps.length === 0 ? '+ Add first step' : '+ Add step'}</option>
            {availableToAdd.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="rounded-lg bg-indigo-50/70 px-2.5 py-1.5 font-mono text-[11.5px] text-indigo-700">
        Calculate on ={' '}
        {steps.length === 0
          ? '—'
          : steps
              .map((s, i) => {
                const label = labelFor(s.source === 'BASE' ? BASE_STEP : s.conditionCode);
                const kind = s.source === 'CONDITION' && s.valueKind === 'CONDITION_BASE' ? ' Base' : '';
                return `${i > 0 ? (s.operator === '-' ? '- ' : '+ ') : s.operator === '-' ? '- ' : ''}${s.percentage}% of ${label}${kind}`;
              })
              .join('  ')}
      </div>
    </div>
  );
}

// Mode 4 — Conditional Rule: a flat IF/AND/OR chain (no operator precedence — a compact
// chip-and-dropdown builder, not a formula language, per the redesign brief's §18) with a
// THEN and an optional ELSE, each a FormulaRuleBuilder.
function ConditionalRuleBuilder({
  rule,
  conditionOptions,
  uomOptions,
  onChange,
}: {
  rule: { clauses: RuleClause[]; then: FormulaRule; else?: FormulaRule };
  conditionOptions: { value: string; label: string }[];
  uomOptions: { value: string; label: string }[];
  onChange: (rule: { clauses: RuleClause[]; then: FormulaRule; else?: FormulaRule }) => void;
}) {
  const fieldOptions = [
    ...PO_RULE_FIELDS.map((f) => ({ key: ruleFieldKey({ source: f.source, field: f.field }), field: { source: f.source, field: f.field } as RuleField, label: `PO — ${f.label}` })),
    ...LINE_RULE_FIELDS.map((f) => ({ key: ruleFieldKey({ source: f.source, field: f.field }), field: { source: f.source, field: f.field } as RuleField, label: `Line — ${f.label}` })),
    ...conditionOptions.map((c) => ({ key: ruleFieldKey({ source: 'CONDITION', field: c.value }), field: { source: 'CONDITION', field: c.value } as RuleField, label: `Condition — ${c.label}` })),
  ];
  const operators: ComparisonOperator[] = ['=', '!=', '>', '<', '>=', '<=', 'IN', 'NOT_IN', 'BETWEEN', 'IS_EMPTY', 'IS_NOT_EMPTY'];

  const updateClause = (i: number, patch: Partial<RuleClause>) => onChange({ ...rule, clauses: rule.clauses.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  const removeClause = (i: number) => onChange({ ...rule, clauses: rule.clauses.filter((_, idx) => idx !== i) });
  const addClause = () => onChange({ ...rule, clauses: [...rule.clauses, { field: { source: 'PO', field: 'baseAmount' }, operator: '>', value: 0, join: 'AND' }] });

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3.5">
      <div className="space-y-2">
        {rule.clauses.map((c, i) => (
          <div key={i} className="space-y-1.5">
            {i > 0 && (
              <div className="flex gap-1.5">
                {(['AND', 'OR'] as const).map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => updateClause(i - 1, { join: j })}
                    className={`rounded px-2 py-0.5 text-[10.5px] font-bold ${rule.clauses[i - 1].join === j || (!rule.clauses[i - 1].join && j === 'AND') ? 'bg-indigo-brand text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {j}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {i === 0 && <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">If</span>}
              <select
                value={ruleFieldKey(c.field)}
                onChange={(e) => {
                  const opt = fieldOptions.find((o) => o.key === e.target.value);
                  if (opt) updateClause(i, { field: opt.field });
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] outline-none"
              >
                {fieldOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={c.operator}
                onChange={(e) => updateClause(i, { operator: e.target.value as ComparisonOperator })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] outline-none"
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {COMPARISON_OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>
              {!['IS_EMPTY', 'IS_NOT_EMPTY'].includes(c.operator) && (
                c.operator === 'BETWEEN' ? (
                  <>
                    <TextInput
                      className="!w-20"
                      value={Array.isArray(c.value) ? c.value[0] : ''}
                      onChange={(e) => updateClause(i, { value: [e.target.value, Array.isArray(c.value) ? c.value[1] : ''] })}
                      placeholder="From"
                    />
                    <TextInput
                      className="!w-20"
                      value={Array.isArray(c.value) ? c.value[1] : ''}
                      onChange={(e) => updateClause(i, { value: [Array.isArray(c.value) ? c.value[0] : '', e.target.value] })}
                      placeholder="To"
                    />
                  </>
                ) : (
                  <TextInput className="!w-28" value={Array.isArray(c.value) ? '' : c.value ?? ''} onChange={(e) => updateClause(i, { value: e.target.value })} placeholder="Value" />
                )
              )}
              <button type="button" onClick={() => removeClause(i)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={addClause} className="flex items-center gap-1 text-[12px] font-semibold text-indigo-brand">
          <Plus size={13} /> Add clause
        </button>
      </div>

      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Then</div>
        <FormulaRuleBuilder value={rule.then} uomOptions={uomOptions} onChange={(then) => onChange({ ...rule, then })} previewLabel="Condition" />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Else</div>
          <Toggle checked={!!rule.else} onChange={(v) => onChange({ ...rule, else: v ? { type: 'PERCENTAGE', value: 0 } : undefined })} />
        </div>
        {rule.else && <FormulaRuleBuilder value={rule.else} uomOptions={uomOptions} onChange={(elseRule) => onChange({ ...rule, else: elseRule })} previewLabel="Condition" />}
      </div>
    </div>
  );
}

function TierTable({
  tiers,
  onChange,
}: {
  tiers: SlabTier[];
  onChange: (tiers: SlabTier[]) => void;
}) {
  const addTier = () => {
    const last = tiers.at(-1);
    onChange([...tiers, { id: uid('tier'), from: last?.to ?? 0, to: (last?.to ?? 0) + 100, rateType: 'FLAT_PER_UNIT', rate: 0 }]);
  };
  const updateTier = (id: string, patch: Partial<SlabTier>) => onChange(tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const removeTier = (id: string) => onChange(tiers.filter((t) => t.id !== id));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
        <div>From</div>
        <div>To (blank = open-ended)</div>
        <div>Rate Type</div>
        <div>Rate</div>
        <div></div>
      </div>
      {tiers.map((t) => (
        <div key={t.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-2">
          <TextInput type="number" value={t.from} onChange={(e) => updateTier(t.id, { from: Number(e.target.value) })} />
          <TextInput type="number" value={t.to ?? ''} onChange={(e) => updateTier(t.id, { to: e.target.value === '' ? null : Number(e.target.value) })} placeholder="1001+" />
          <SelectInput
            value={t.rateType}
            onChange={(v) => updateTier(t.id, { rateType: v as SlabTier['rateType'] })}
            options={[{ value: 'FLAT_PER_UNIT', label: '₹ per unit' }, { value: 'PERCENTAGE', label: '%' }]}
          />
          <TextInput type="number" value={t.rate} onChange={(e) => updateTier(t.id, { rate: Number(e.target.value) })} />
          <button onClick={() => removeTier(t.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {tiers.length === 0 && <div className="text-[12.5px] text-slate-400">No tiers yet.</div>}
      <button type="button" onClick={addTier} className="flex items-center gap-1 text-[12px] font-semibold text-indigo-brand">
        <Plus size={13} /> Add slab
      </button>
    </div>
  );
}

// Mode 5 — Slab / Tier: range-based pricing, matched by whichever basis the master picks
// (quantity, weight, volume, this line's base, or the whole PO's base).
function SlabRuleBuilder({ rule, onChange }: { rule: { basis: SlabBasis; tiers: SlabTier[] }; onChange: (r: { basis: SlabBasis; tiers: SlabTier[] }) => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3.5">
      <Field label="Based On">
        <SelectInput value={rule.basis} onChange={(v) => onChange({ ...rule, basis: v as SlabBasis })} options={(Object.keys(SLAB_BASIS_LABELS) as SlabBasis[]).map((b) => ({ value: b, label: SLAB_BASIS_LABELS[b] }))} />
      </Field>
      <TierTable tiers={rule.tiers} onChange={(tiers) => onChange({ ...rule, tiers })} />
    </div>
  );
}

// Mode 6 — Cumulative / Volume-based Rule: same tier-matching as Slab, but the driver is
// (mocked, see engine/calc.ts getCumulativeHistoryTotal) the current period plus a running
// total scoped to a vendor/contract/blanket-PO/material/etc.
function CumulativeRuleBuilder({
  rule,
  onChange,
}: {
  rule: { basis: CumulativeBasis; scope: CumulativeScope; tiers: SlabTier[] };
  onChange: (r: { basis: CumulativeBasis; scope: CumulativeScope; tiers: SlabTier[] }) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cumulative Basis">
          <SelectInput value={rule.basis} onChange={(v) => onChange({ ...rule, basis: v as CumulativeBasis })} options={(Object.keys(CUMULATIVE_BASIS_LABELS) as CumulativeBasis[]).map((b) => ({ value: b, label: CUMULATIVE_BASIS_LABELS[b] }))} />
        </Field>
        <Field label="Scope" hint="No historical backend exists in this prototype yet — the running total starts from the current PO/line only.">
          <SelectInput value={rule.scope} onChange={(v) => onChange({ ...rule, scope: v as CumulativeScope })} options={(Object.keys(CUMULATIVE_SCOPE_LABELS) as CumulativeScope[]).map((s) => ({ value: s, label: CUMULATIVE_SCOPE_LABELS[s] }))} />
        </Field>
      </div>
      <TierTable tiers={rule.tiers} onChange={(tiers) => onChange({ ...rule, tiers })} />
    </div>
  );
}
