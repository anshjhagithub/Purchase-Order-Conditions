// ─────────────────────────────────────────────────────────────────────────
// PO Conditions — core data model, mirrors PO-Conditions-PRD.md §3–§5
// ─────────────────────────────────────────────────────────────────────────

export type CategoryCode = 'DISC' | 'SURC' | 'LOGI' | 'STAT' | 'DEDN' | 'OTHR';

export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  DISC: 'Discount',
  SURC: 'Surcharge',
  LOGI: 'Logistics / Delivery Cost',
  STAT: 'Statutory Levy / Duty',
  DEDN: 'Deduction / Retention',
  OTHR: 'Other Charge / Pass-through',
};

export const CATEGORY_COLORS: Record<CategoryCode, { bg: string; text: string; dot: string }> = {
  DISC: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  SURC: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  LOGI: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  STAT: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  DEDN: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  OTHR: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
};

export type CalculationBasis =
  | 'FIXED_PER_PO'
  | 'FIXED_PER_LINE'
  | 'RATE_X_QTY'
  | 'PCT_OF_LINE_BASE'
  | 'PCT_OF_SELECTED_BASE'
  | 'RATE_X_WEIGHT'
  | 'RATE_X_VOLUME'
  | 'SLAB';

export const CALC_BASIS_LABELS: Record<CalculationBasis, string> = {
  FIXED_PER_PO: 'Fixed amount — per PO',
  FIXED_PER_LINE: 'Fixed amount — per line',
  RATE_X_QTY: 'Rate × line quantity',
  PCT_OF_LINE_BASE: '% of line base value',
  PCT_OF_SELECTED_BASE: '% of selected base',
  RATE_X_WEIGHT: 'Rate × weight',
  RATE_X_VOLUME: 'Rate × volume',
  SLAB: 'Slab / scale',
};

export const CALC_BASIS_RATE_LABEL: Record<CalculationBasis, string> = {
  FIXED_PER_PO: 'Amount',
  FIXED_PER_LINE: 'Amount',
  RATE_X_QTY: 'Rate per unit',
  PCT_OF_LINE_BASE: 'Percentage',
  PCT_OF_SELECTED_BASE: 'Percentage',
  RATE_X_WEIGHT: 'Rate per KG/MT',
  RATE_X_VOLUME: 'Rate per CBM',
  SLAB: 'Slab grid',
};

export type Sign = '+' | '-';
export type CodeType = 'HSN' | 'SAC';
export type GstTreatment = 'DEDUCTIBLE' | 'NON_DEDUCTIBLE' | 'RCM' | 'EXEMPT' | 'NIL_RATED';
export const GST_TREATMENT_LABELS: Record<GstTreatment, string> = {
  DEDUCTIBLE: 'Deductible',
  NON_DEDUCTIBLE: 'Non-deductible',
  RCM: 'RCM',
  EXEMPT: 'Exempt',
  NIL_RATED: 'Nil-rated',
};

export type VendorRule = 'SAME_AS_PO' | 'MUST_DIFFER' | 'EITHER';
export const VENDOR_RULE_LABELS: Record<VendorRule, string> = {
  SAME_AS_PO: 'Same as PO vendor',
  MUST_DIFFER: 'Must be different',
  EITHER: 'Either',
};

export type AllowedLevel = 'LINE' | 'HEADER' | 'BOTH';
export type DistributionBasis = 'VALUE' | 'QUANTITY' | 'WEIGHT' | 'VOLUME' | 'EQUAL';
export const DISTRIBUTION_LABELS: Record<DistributionBasis, string> = {
  VALUE: 'Value',
  QUANTITY: 'Quantity',
  WEIGHT: 'Weight',
  VOLUME: 'Volume',
  EQUAL: 'Equal split',
};

export type InvoiceLevel = 'LINE_ITEM' | 'ADDITIONAL_CHARGE' | 'DISCOUNT';
export const INVOICE_LEVEL_LABELS: Record<InvoiceLevel, string> = {
  LINE_ITEM: 'Line Item',
  ADDITIONAL_CHARGE: 'Additional Charge',
  DISCOUNT: 'Discount',
};

export type RoundingRule = 'NORMAL' | 'UP' | 'DOWN' | 'NONE';
export type ReleaseTrigger = 'MANUAL' | 'WARRANTY_EXPIRY' | 'COMMISSIONING' | 'ON_DATE';
export type ConfirmationMode = 'PROPORTIONAL' | 'FULL_ON_FIRST_GRN';
export type ConditionStatus = 'Active' | 'Inactive';

export interface SlabRow {
  id: string;
  from: number;
  to: number;
  rate: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Calculate-On rule model (replaces Sequence No.) — dependency order is
// derived purely from which condition codes a rule *references*, never from
// a stored execution-order number. See engine/calc.ts `dependenciesOf` /
// `orderByDependency` for how a rule's references become graph edges, and
// `getEffectiveRule` for how legacy calcBasis/calculateOn records (saved
// before this model existed) are read as an equivalent rule with no data
// migration required.
// ─────────────────────────────────────────────────────────────────────────
export type CalculationMode = 'BASE' | 'SELECTED_CONDITIONS' | 'DIRECT' | 'CONDITIONAL' | 'SLAB' | 'CUMULATIVE';

export const CALCULATION_MODE_LABELS: Record<CalculationMode, string> = {
  BASE: 'Base',
  SELECTED_CONDITIONS: 'Selected Conditions',
  DIRECT: 'Direct Calculation',
  CONDITIONAL: 'Conditional Rule',
  SLAB: 'Slab / Tier',
  CUMULATIVE: 'Cumulative / Volume-based Rule',
};

// A single-formula amount — "2% of Base", "₹5,000 flat", "₹20 × Qty" — shared by
// BASE mode, DIRECT mode, and the THEN/ELSE branches of a CONDITIONAL rule.
export type FormulaType = 'PERCENTAGE' | 'FIXED' | 'RATE_X_QTY' | 'RATE_X_WEIGHT' | 'RATE_X_VOLUME';
export const FORMULA_TYPE_LABELS: Record<FormulaType, string> = {
  PERCENTAGE: '% of Base',
  FIXED: 'Fixed Amount',
  RATE_X_QTY: 'Rate × Quantity',
  RATE_X_WEIGHT: 'Rate × Weight',
  RATE_X_VOLUME: 'Rate × Volume',
};
export interface FormulaRule {
  type: FormulaType;
  value: number; // %, flat amount, or rate-per-unit depending on `type`
  uomId?: string; // for RATE_X_QTY/WEIGHT/VOLUME
}

// One weighted term of a SELECTED_CONDITIONS sum: "+ 20% of BCD's Condition Amount".
export type SelectedStepSource = 'BASE' | 'CONDITION';
export type SelectedStepValueKind = 'CONDITION_AMOUNT' | 'CONDITION_BASE';
export interface SelectedStep {
  operator: '+' | '-';
  source: SelectedStepSource;
  conditionCode?: string; // required when source === 'CONDITION'
  valueKind?: SelectedStepValueKind; // default 'CONDITION_AMOUNT' — never silently reads the configured rate
  percentage: number; // weight %, default 100
}
export interface SelectedConditionsRule {
  steps: SelectedStep[];
}

export type ComparisonOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT_IN' | 'BETWEEN' | 'IS_EMPTY' | 'IS_NOT_EMPTY';
export const COMPARISON_OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  '=': '=',
  '!=': '≠',
  '>': '>',
  '<': '<',
  '>=': '≥',
  '<=': '≤',
  IN: 'IN',
  NOT_IN: 'NOT IN',
  BETWEEN: 'BETWEEN',
  IS_EMPTY: 'IS EMPTY',
  IS_NOT_EMPTY: 'IS NOT EMPTY',
};

// Left-hand side of a conditional-rule clause. `field` is a key into the registry
// in engine/ruleFields.ts (PO attribute, line attribute, or another condition's
// calculated amount when source === 'CONDITION').
export type RuleFieldSource = 'PO' | 'LINE' | 'CONDITION';
export interface RuleField {
  source: RuleFieldSource;
  field: string; // registry key, or a condition code when source === 'CONDITION'
}
export interface RuleClause {
  field: RuleField;
  operator: ComparisonOperator;
  value?: string | number | [string | number, string | number]; // BETWEEN uses a tuple
  join?: 'AND' | 'OR'; // how this clause combines with the NEXT one in the list
}
export interface ConditionalRule {
  clauses: RuleClause[];
  then: FormulaRule;
  else?: FormulaRule;
}

export type SlabRateType = 'PERCENTAGE' | 'FLAT_PER_UNIT';
export interface SlabTier {
  id: string;
  from: number;
  to: number | null; // null = open-ended ("1001+")
  rateType: SlabRateType;
  rate: number;
}
export type SlabBasis = 'QUANTITY' | 'CUMULATIVE_QUANTITY' | 'WEIGHT' | 'VOLUME' | 'BASE_AMOUNT' | 'PO_AMOUNT' | 'DATE_RANGE';
export const SLAB_BASIS_LABELS: Record<SlabBasis, string> = {
  QUANTITY: 'Quantity',
  CUMULATIVE_QUANTITY: 'Cumulative Quantity',
  WEIGHT: 'Weight',
  VOLUME: 'Volume',
  BASE_AMOUNT: 'Base Amount',
  PO_AMOUNT: 'PO Amount',
  DATE_RANGE: 'Date Range',
};
export interface SlabRule {
  basis: SlabBasis;
  tiers: SlabTier[];
}

export type CumulativeBasis = 'QUANTITY' | 'VALUE' | 'WEIGHT' | 'VOLUME';
export const CUMULATIVE_BASIS_LABELS: Record<CumulativeBasis, string> = {
  QUANTITY: 'Cumulative Quantity',
  VALUE: 'Cumulative Value',
  WEIGHT: 'Cumulative Weight',
  VOLUME: 'Cumulative Volume',
};
export type CumulativeScope = 'VENDOR' | 'CONTRACT' | 'BLANKET_PO' | 'MATERIAL' | 'MATERIAL_CATEGORY' | 'ENTITY' | 'PLANT' | 'PROJECT';
export const CUMULATIVE_SCOPE_LABELS: Record<CumulativeScope, string> = {
  VENDOR: 'Vendor',
  CONTRACT: 'Contract',
  BLANKET_PO: 'Blanket PO',
  MATERIAL: 'Material',
  MATERIAL_CATEGORY: 'Material Category',
  ENTITY: 'Entity',
  PLANT: 'Plant',
  PROJECT: 'Project',
};
export interface CumulativeRule {
  basis: CumulativeBasis;
  scope: CumulativeScope;
  // Current PO/line's own driver is added to a (currently mocked — see engine/calc.ts
  // `getCumulativeHistoryTotal`) running total for the scope before tiers are matched.
  tiers: SlabTier[];
}

export type CalculationRule =
  | { mode: 'BASE'; base: FormulaRule }
  | { mode: 'SELECTED_CONDITIONS'; selected: SelectedConditionsRule }
  | { mode: 'DIRECT'; direct: FormulaRule }
  | { mode: 'CONDITIONAL'; conditional: ConditionalRule }
  | { mode: 'SLAB'; slab: SlabRule }
  | { mode: 'CUMULATIVE'; cumulative: CumulativeRule };

// ── Section 1: Identity ─────────────────────────────────────────────────
// ── Section 2: Calculation ──────────────────────────────────────────────
// ── Section 3: Tax ──────────────────────────────────────────────────────
// ── Section 4: Vendor & Ownership ───────────────────────────────────────
// ── Section 5: Advanced Settings ────────────────────────────────────────
export interface ConditionMaster {
  id: string;
  // 1 Identity
  code: string;
  name: string;
  category: CategoryCode;
  subCategory?: string;
  description?: string;
  printOnPdf: boolean;

  // 2 Calculation
  calcBasis: CalculationBasis;
  uomId?: string;
  defaultRate?: number;
  sign: Sign;
  currency: string;
  statistical: boolean;
  rounding: RoundingRule;

  // 3 Tax
  codeType: CodeType;
  taxCode?: string; // HSN/SAC
  gstRate?: number; // derived, read-only (from tax master)
  gstTreatment: GstTreatment;
  itcEligibilityPct: number;
  taxCalculatedOn: 'CONDITION_AMOUNT' | 'CONDITION_PLUS_SELECTED';
  tdsApplicable: boolean;
  tdsSection?: string;
  tcsApplicable: boolean;
  tcsSection?: string;

  // 4 Vendor & Ownership
  defaultVendorId?: string;
  vendorRule: VendorRule;
  vendorGroupFilter: string[];
  defaultInvoiceOwner?: string;
  defaultConfirmationOwner?: string;

  // 5 Advanced
  // No Sequence No. field — calculation order is derived automatically from which
  // condition codes each condition's rule references (engine/calc.ts `orderByDependency`).
  calculationMode?: CalculationMode; // undefined = legacy record, see getEffectiveRule()
  calculationRule?: CalculationRule;
  // Legacy Calculate-On fields — still read by getEffectiveRule() for any Condition Master
  // saved before the rule-builder existed, so old data keeps computing identically without
  // a migration step. The form no longer writes these directly; new/edited conditions get
  // calculationMode + calculationRule instead. (`calcBasis` is declared in §2 above.)
  calculateOn: 'LINE_BASE' | 'SELECTED';
  calculateOnCodes: string[];
  calculateOnWeights?: Record<string, number>;
  slabTable: SlabRow[];
  // Post-calculation clamp, applied to the raw amount's magnitude before sign/rounding —
  // distinct from Min Value / Max Value below, which validate the *rate/entry* on the PO form.
  minChargeAmount?: number;
  maxChargeAmount?: number;
  capitalise: boolean;
  allowedLevel: AllowedLevel;
  distributionBasis?: DistributionBasis;
  requiresServiceConfirmation: boolean;
  autoConfirmOnMainGrn: boolean;
  confirmationOnPartialGrn: ConfirmationMode;
  // Gates condition-GRN creation independently of Requires Service Confirmation: when true,
  // a GRN for this condition cannot be created until the underlying PO line has an item GRN
  // (renamed from lineItemGrnRequired — same semantics).
  parentGrnRequired: boolean;
  // Whether this condition participates in the GRN workflow at all — false means it never
  // shows up as something to confirm/GRN (e.g. a discount).
  grnRequired: boolean;
  invoiceLevel: InvoiceLevel;
  rateEditableOnPo: boolean;
  vendorEditableOnPo: boolean;
  minValue?: number;
  maxValue?: number;
  approvalThreshold?: number;
  applicabilityEntities: string[];
  applicabilityCategories: string[];
  applicabilityVendors: string[];
  mandatoryFor: string[];
  mutuallyExclusiveWith: string[];
  requiresAttachment: boolean;
  reversible: boolean;
  releaseTrigger?: ReleaseTrigger;
  indexReferenceId?: string;
  indexRevisionFrequency?: string;
  indexRevisionLag?: number;
  validFrom: string;
  validTo?: string;
  status: ConditionStatus;
  version: number;

  usedOnAnyPo: boolean; // drives immutability of category (M6)
}

// ── Supporting masters ──────────────────────────────────────────────────
export interface Vendor {
  id: string;
  name: string;
  state: string;
  gstin: string;
  vendorGroup: string;
  isMsme?: boolean;
  email?: string;
  phone?: string;
  address?: string;
}

export interface TaxMasterEntry {
  id: string;
  codeType: CodeType;
  code: string;
  description: string;
  gstRate: number;
  effectiveFrom: string;
}

export type UomDimension = 'COUNT' | 'WEIGHT' | 'VOLUME' | 'TIME' | 'AREA';
export interface UoM {
  id: string;
  name: string;
  dimension: UomDimension;
}

export interface ItemMasterEntry {
  id: string;
  name: string;
  hsn: string;
  uomId: string;
  unitWeightKg: number;
  unitVolumeCbm: number;
}

export interface IndexMasterEntry {
  id: string;
  name: string;
  currentValue: number;
  unit: string;
}

export interface Entity {
  id: string;
  name: string;
  state: string;
  gstin: string;
}

// ── PO model ─────────────────────────────────────────────────────────────
export type ConditionLevel = 'LINE' | 'HEADER';
export type AppliedConditionStatus = 'Draft' | 'Confirmed' | 'Partially Confirmed';

export interface AppliedCondition {
  id: string;
  conditionCode: string; // FK -> ConditionMaster.code (snapshot at add-time)
  conditionName: string;
  category: CategoryCode;
  level: ConditionLevel;
  lineId?: string; // set when level === 'LINE'
  applyToLineIds?: string[]; // for header conditions distributed across specific lines
  // No Sequence No. — see ConditionMaster. Snapshotted from the master at add-time,
  // same as every other calc field below (so a later master edit doesn't retroactively
  // change amounts already on this PO).
  calculationMode?: CalculationMode;
  calculationRule?: CalculationRule;
  calcBasis: CalculationBasis;
  calculateOn: 'LINE_BASE' | 'SELECTED';
  calculateOnCodes: string[];
  calculateOnWeights?: Record<string, number>; // code -> weight %, default 100 (see ConditionMaster)
  slabTable?: SlabRow[];
  minChargeAmount?: number;
  maxChargeAmount?: number;
  sign: Sign;
  rate: number; // rate / % / amount as entered on the PO
  qty: number;
  uomId?: string;
  vendorId: string;
  vendorName: string;
  poForConditionId?: string;
  distributionBasis?: DistributionBasis;
  codeType: CodeType;
  taxCode?: string;
  gstRate: number;
  gstTreatment: GstTreatment;
  capitalise: boolean;
  statistical: boolean;
  rounding: RoundingRule;
  requiresServiceConfirmation: boolean;
  autoConfirmOnMainGrn: boolean;
  confirmationMode: ConfirmationMode;
  parentGrnRequired: boolean;
  grnRequired: boolean;
  status: AppliedConditionStatus;
  confirmedPct: number; // 0-100
  notes?: string;
  attachmentName?: string;
  currency: string;
}

export interface POLine {
  id: string;
  lineNo: number;
  itemName: string;
  itemRef: string;
  hsn: string;
  qty: number;
  uom: string;
  unitPrice: number;
  unitWeightKg: number;
  unitVolumeCbm: number;
  deliveryAddress: string;
  deliveryDate: string;
  deliveredQty: number;
  invoiceQty: number;
  conditions: AppliedCondition[]; // line-level conditions
}

export type POStage =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Sent to Vendor'
  | 'Goods Receipt Pending'
  | 'Invoice Pending'
  | 'Closed';

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  entityId: string;
  deliveryState: string;
  deliveryAddress: string;
  currency: string;
  incoterm?: string;
  stage: POStage;
  stageIndex: number; // 1-7
  stagePercent: number;
  owner: string;
  lines: POLine[];
  headerConditions: AppliedCondition[];
  invoiceClaims?: InvoiceClaim[];
  createdAt: string;
  createdBy: string;
  // List-view / spend-classification fields (Dashboard table) — distinct from a
  // condition's own `category` (CategoryCode), which is the DISC/SURC/etc master switch.
  office: string;
  submittedBy: string;
  spendSuperCategory: string;
  spendCategory: string;
}

// ── Invoice matching (vendor-wise, per PRD §7.6 / condition_invoice_claim) ─
// One claim per vendor payable (material vendor's base+same-vendor conditions,
// or a condition-vendor's own conditions e.g. freight/CHA/insurance). Kept
// separate from AppliedCondition.status (GRN-side confirmation) — a claim can
// only be raised once its underlying conditions are confirmed, or parked
// with ON_HOLD_GRN otherwise.
export type InvoiceClaimStatus = 'MATCHED' | 'VARIANCE_PENDING' | 'APPROVED' | 'ON_HOLD_GRN';
export const INVOICE_CLAIM_STATUS_LABELS: Record<InvoiceClaimStatus, string> = {
  MATCHED: 'Matched',
  VARIANCE_PENDING: 'Variance — pending approval',
  APPROVED: 'Variance approved',
  ON_HOLD_GRN: 'On hold — awaiting GRN',
};

export interface InvoiceClaim {
  id: string;
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  plannedAmount: number; // snapshot of computed vendor payable when raised
  claimedAmount: number;
  varianceAmount: number;
  variancePct: number;
  status: InvoiceClaimStatus;
  spansOtherPOs: boolean; // consolidated invoice covering multiple POs from this vendor
  conditionIds: string[]; // AppliedCondition ids this claim's amount is matched against
}

export interface ConditionBundle {
  id: string;
  name: string;
  description: string;
  conditionCodes: string[];
}
