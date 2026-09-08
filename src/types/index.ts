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

  // 4 Vendor & Ownership
  defaultVendorId?: string;
  vendorRule: VendorRule;
  vendorGroupFilter: string[];
  defaultInvoiceOwner?: string;
  defaultConfirmationOwner?: string;

  // 5 Advanced
  sequence: number;
  calculateOn: 'LINE_BASE' | 'SELECTED';
  calculateOnCodes: string[]; // lower-sequence condition codes
  capitalise: boolean;
  allowedLevel: AllowedLevel;
  distributionBasis?: DistributionBasis;
  requiresServiceConfirmation: boolean;
  autoConfirmOnMainGrn: boolean;
  confirmationOnPartialGrn: ConfirmationMode;
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
  slabTable: SlabRow[];
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
  sequence: number;
  calcBasis: CalculationBasis;
  calculateOn: 'LINE_BASE' | 'SELECTED';
  calculateOnCodes: string[];
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
  createdAt: string;
  createdBy: string;
  // List-view / spend-classification fields (Dashboard table) — distinct from a
  // condition's own `category` (CategoryCode), which is the DISC/SURC/etc master switch.
  office: string;
  submittedBy: string;
  spendSuperCategory: string;
  spendCategory: string;
}

export interface ConditionBundle {
  id: string;
  name: string;
  description: string;
  conditionCodes: string[];
}
