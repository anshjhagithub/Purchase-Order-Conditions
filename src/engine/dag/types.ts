// Types for the dependency-graph (no-sequence) PO condition calculation engine.
//
// This mirrors only the fields on "Add Custom PO Condition" that are actually
// calculation-relevant (spec: DICE_PO_Condition_Calculation_Engine.txt, §3).
// It intentionally does NOT reuse src/types/index.ts's AppliedCondition, which
// carries a `sequence` field used by the existing src/engine/calc.ts — this
// engine is additive and must not change that existing behavior.

export type CalculationBasis =
  | 'FIXED_PER_PO'
  | 'FIXED_PER_LINE'
  | 'RATE_X_QTY'
  | 'PCT_OF_LINE_BASE'
  | 'PCT_OF_SELECTED_BASE'
  | 'RATE_X_WEIGHT'
  | 'RATE_X_VOLUME'
  | 'SLAB';

export type Sign = '+' | '-';
export type RoundingRule = 'NORMAL' | 'UP' | 'DOWN' | 'NONE';
export type GstTreatment = 'DEDUCTIBLE' | 'NON_DEDUCTIBLE' | 'RCM' | 'EXEMPT' | 'NIL_RATED';
export type TaxCalculatedOn = 'CONDITION_AMOUNT' | 'CONDITION_PLUS_SELECTED';
export type VendorRule = 'SAME_AS_PO' | 'MUST_DIFFER' | 'EITHER';
export type CalculateOn = 'LINE_BASE' | 'SELECTED';
export type AllowedLevel = 'LINE' | 'HEADER' | 'BOTH';
export type DistributionBasis = 'VALUE' | 'QUANTITY' | 'WEIGHT' | 'VOLUME' | 'EQUAL';
export type CategoryCode = 'DISC' | 'SURC' | 'LOGI' | 'STAT' | 'DEDN' | 'OTHR';
export type SlabDriverBasis = 'QTY' | 'WEIGHT' | 'VOLUME' | 'SELECTED_BASE';

// Sentinel meaning "the line's/PO's own base value" inside calculateOnCodes —
// the one non-condition node every dependency graph is rooted at.
export const BASE_STEP = 'BASE';

export interface SlabRow {
  from: number;
  to: number;
  rate: number; // flat rate applied per unit of the slab driver (NOT a percentage)
}

export interface Vendor {
  id: string;
  name: string;
  state: string;
}

/**
 * The calculation-relevant subset of an AppliedCondition, per the spec.
 * `calculateOnCodes` is the ONLY thing that declares calculation order —
 * there is no sequence number anywhere on this type.
 */
export interface DagCondition {
  id: string;
  conditionCode: string;
  conditionMasterVersion: number;

  category: CategoryCode;
  level: 'LINE' | 'HEADER';
  applyToLineIds?: string[]; // HEADER conditions only; empty/undefined = all lines

  calcBasis: CalculationBasis;
  uom?: string;
  rate: number; // "rateOrAmount" per spec — amount, per-unit rate, or percentage depending on calcBasis
  sign: Sign;
  rounding: RoundingRule;
  statistical: boolean;

  slabTable?: SlabRow[];
  slabDriverBasis?: SlabDriverBasis; // defaults: SELECTED base if calculateOn==='SELECTED', else QTY

  gstTreatment: GstTreatment;
  gstRate: number; // percent
  taxCalculatedOn: TaxCalculatedOn;
  taxBaseCodes?: string[]; // used only when taxCalculatedOn === 'CONDITION_PLUS_SELECTED'

  vendorRule: VendorRule;
  vendorId: string;
  vendorName: string;

  calculateOn: CalculateOn;
  calculateOnCodes: string[]; // dependency declaration: conditionCode[] and/or BASE_STEP

  capitalise: boolean;
  allowedLevel: AllowedLevel;
  distributionBasis?: DistributionBasis; // HEADER conditions only

  requiresServiceConfirmation: boolean;
  confirmed: boolean; // simplified GRN-confirmation flag for invoice-eligibility
}

export interface DagLine {
  id: string;
  qty: number;
  unitPrice: number;
  unitWeightKg?: number;
  unitVolumeCbm?: number;
  conditions: DagCondition[]; // this line's own LINE-level conditions only
}

export interface DagPurchaseOrder {
  vendorId: string;
  vendorName: string;
  deliveryState: string;
  lines: DagLine[];
  headerConditions: DagCondition[]; // HEADER-level conditions, applied before distribution
}

export type Jurisdiction = 'CGST_SGST' | 'CGST_UTGST' | 'IGST' | 'RCM' | 'NONE';

export interface ComputedCondition {
  conditionCode: string;
  calcBasis: CalculationBasis;

  calculationBaseAmount: number; // the base this condition's rate/% was applied to
  dependencyAmounts: Record<string, number>; // BASE + each referenced code -> its amount

  inputRate: number;
  inputQuantity?: number;
  inputWeight?: number;
  inputVolume?: number;

  rawAmount: number;
  signedAmount: number;
  roundedAmount: number;

  gstRate: number;
  gstAmount: number;
  jurisdiction: Jurisdiction;
  cgst: number;
  sgst: number;
  igst: number;
  utgst: number;
  rcmAmount: number;

  vendorId: string;
  vendorName: string;
  vendorPayableAmount: number; // 0 for statistical and for the GST portion of RCM
  landedCostAmount: number; // roundedAmount if capitalise, else 0

  statistical: boolean;
  capitalise: boolean;

  calculationBreakdown: string;
}
