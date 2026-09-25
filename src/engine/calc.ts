import type {
  AppliedCondition,
  CalculationRule,
  CategoryCode,
  DistributionBasis,
  FormulaRule,
  POLine,
  PurchaseOrder,
  RoundingRule,
  RuleClause,
  RuleField,
  SelectedStep,
  SlabTier,
  Vendor,
} from '../types';
import { resolveFieldValue as resolveFieldValueImpl } from './ruleFields';

// Sentinel used inside AppliedCondition.calculateOnCodes (legacy Calculate-On model)
// and SelectedStep.source === 'BASE' (current rule model) to represent "line base
// value" as one selectable step in a Calculate-On chain.
export const BASE_STEP = 'BASE';

const UNION_TERRITORIES = new Set([
  'Chandigarh',
  'Delhi',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
  'Andaman and Nicobar Islands',
  'Dadra and Nagar Haveli and Daman and Diu',
]);

export function roundAmount(value: number, rule: RoundingRule): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  switch (rule) {
    case 'NORMAL':
      return sign * Math.round(abs);
    case 'UP':
      return sign * Math.ceil(abs);
    case 'DOWN':
      return sign * Math.floor(abs);
    case 'NONE':
    default:
      return Math.round(value * 100) / 100;
  }
}

export interface ConditionCalcContext {
  lineBaseValue: number;
  lineQty: number;
  unitWeightKg: number;
  unitVolumeCbm: number;
  priorAmounts: Record<string, number>; // conditionCode -> already-computed signed amount
  priorBases?: Record<string, number>; // conditionCode -> calc base that condition used
  // Attribute snapshot for CONDITIONAL-rule field resolution (engine/ruleFields.ts).
  // All optional so existing call sites that only care about the numeric driver fields
  // (e.g. GRNTab's qty-variance recompute) don't need to change.
  poBaseAmount?: number;
  incoterm?: string;
  vendorGroup?: string;
  entityId?: string;
  currency?: string;
  deliveryState?: string;
}

export interface ComputedConditionLine extends AppliedCondition {
  calcBaseUsed: number;
  computedAmount: number; // signed, rounded
  computedGstAmount: number;
  jurisdiction: 'CGST_SGST' | 'CGST_UTGST' | 'IGST' | 'RCM' | 'NONE';
  cgst: number;
  sgst: number;
  igst: number;
  utgst: number;
  rcmAmount: number;
  // The driver quantities the engine actually multiplied against (line qty for LINE
  // conditions, qty-weighted line average for HEADER conditions) — carried on the item
  // itself so a calculation breakdown can be rendered without re-deriving line context.
  ctxQty: number;
  ctxUnitWeightKg: number;
  ctxUnitVolumeCbm: number;
  // Set by the dispatcher for BASE/DIRECT/CONDITIONAL rule modes — the specific formula
  // that actually fired (for CONDITIONAL, whichever of THEN/ELSE matched) — purely for
  // describeCalculation()'s human-readable text; not consulted by the calc logic itself.
  effectiveFormula?: FormulaRule;
  conditionalBranch?: 'THEN' | 'ELSE';
  // True when a Minimum/Maximum Calculated Amount clamp changed the raw result.
  chargeClamped?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Dependency graph — condition order is derived purely from which condition
// codes a condition's rule *references*, never from a stored sequence number.
// ─────────────────────────────────────────────────────────────────────────

type DependencySource = Pick<AppliedCondition, 'calculationMode' | 'calculationRule' | 'calculateOn' | 'calculateOnCodes'>;

export function dependenciesOf(cond: DependencySource): string[] {
  if (cond.calculationMode && cond.calculationRule) {
    const rule = cond.calculationRule;
    if (rule.mode === 'SELECTED_CONDITIONS') {
      return rule.selected.steps.filter((s) => s.source === 'CONDITION' && s.conditionCode).map((s) => s.conditionCode!);
    }
    if (rule.mode === 'CONDITIONAL') {
      return rule.conditional.clauses.filter((c) => c.field.source === 'CONDITION').map((c) => c.field.field);
    }
    return [];
  }
  // Legacy Calculate-On (no rule model on this record yet) — same edges as before.
  return cond.calculateOn === 'SELECTED' ? cond.calculateOnCodes.filter((c) => c !== BASE_STEP) : [];
}

// Orders a set of conditions (one line's, or one PO's header set) so that every
// condition is evaluated after everything it references. No sequence number is
// consulted to decide *what depends on what* — only the rule's own references
// (dependenciesOf). Independent conditions (no reference to one another) are
// ordered alphabetically by conditionCode purely for a stable, readable display —
// that ordering never overrides an actual dependency edge.
export function orderByDependency<T extends AppliedCondition>(conditions: T[]): T[] {
  const byCodeAlpha = [...conditions].sort((a, b) => a.conditionCode.localeCompare(b.conditionCode));
  const codes = new Set(conditions.map((c) => c.conditionCode));
  const graph = new Map<string, string[]>();

  try {
    for (const cond of conditions) {
      const edges: string[] = [];
      for (const dep of dependenciesOf(cond)) {
        if (dep === cond.conditionCode) {
          throw new Error(`"${cond.conditionCode}" cannot depend on itself.`);
        }
        if (!codes.has(dep)) {
          // Referenced condition isn't part of this evaluation set (e.g. applied to
          // a different line) — nothing to order against here; computeConditionAmount
          // already treats a missing priorAmounts entry as 0.
          continue;
        }
        edges.push(dep);
      }
      graph.set(cond.conditionCode, edges);
    }

    const WHITE = 0,
      GRAY = 1,
      BLACK = 2;
    const state = new Map<string, number>();
    for (const code of graph.keys()) state.set(code, WHITE);
    const path: string[] = [];

    const visit = (code: string) => {
      state.set(code, GRAY);
      path.push(code);
      for (const dep of graph.get(code) ?? []) {
        const depState = state.get(dep);
        if (depState === GRAY) {
          throw new Error(`Circular calculation dependency detected: ${[...path.slice(path.indexOf(dep)), dep].join(' → ')}`);
        }
        if (depState === WHITE) visit(dep);
      }
      path.pop();
      state.set(code, BLACK);
    };
    for (const code of graph.keys()) {
      if (state.get(code) === WHITE) visit(code);
    }
  } catch (err) {
    console.warn('[PO condition engine] falling back to alphabetical order:', err instanceof Error ? err.message : err);
    return byCodeAlpha;
  }

  const byCode = new Map(conditions.map((c) => [c.conditionCode, c]));
  // Deterministic base iteration order = code, so independent conditions keep a
  // stable relative order; dependency edges still force dependents last.
  const sortedCodes = byCodeAlpha.map((c) => c.conditionCode);
  const visited = new Set<string>();
  const ordered: T[] = [];
  const visitOrder = (code: string) => {
    if (visited.has(code)) return;
    visited.add(code);
    for (const dep of graph.get(code) ?? []) visitOrder(dep);
    ordered.push(byCode.get(code)!);
  };
  for (const code of sortedCodes) visitOrder(code);
  return ordered;
}

// Detects a circular dependency that WOULD be created by saving `candidate` (used at
// Condition Master save-time, before Sequence No. existed as a safety net). Runs the
// same DFS as orderByDependency but across the full master list with `candidate`
// substituted in, and throws a human-readable message naming the cycle.
export function detectCircularDependency(
  candidate: { code: string } & DependencySource,
  allMasters: ({ code: string } & DependencySource)[]
): string | null {
  const byCode = new Map(allMasters.map((m) => [m.code, m]));
  byCode.set(candidate.code, candidate);

  const state = new Map<string, number>(); // 0 unvisited, 1 in-progress, 2 done
  const path: string[] = [];
  let cycleMessage: string | null = null;

  const visit = (code: string) => {
    if (cycleMessage) return;
    const st = state.get(code) ?? 0;
    if (st === 2) return;
    if (st === 1) {
      const start = path.indexOf(code);
      const cycle = [...path.slice(start), code];
      cycleMessage = `Cannot save this condition because it creates a circular dependency with ${cycle.filter((c) => c !== candidate.code)[0] ?? cycle[1] ?? code} (${cycle.join(' → ')}).`;
      return;
    }
    state.set(code, 1);
    path.push(code);
    const cond = byCode.get(code);
    if (cond) {
      for (const dep of dependenciesOf(cond)) {
        if (dep === code) {
          cycleMessage = `Cannot save this condition because it references itself.`;
          break;
        }
        visit(dep);
        if (cycleMessage) break;
      }
    }
    path.pop();
    state.set(code, 2);
  };

  visit(candidate.code);
  return cycleMessage;
}

// ─────────────────────────────────────────────────────────────────────────
// Rule evaluation — BASE / DIRECT / SELECTED_CONDITIONS / CONDITIONAL / SLAB /
// CUMULATIVE. Every mode reduces to the same output shape, { raw, calcBase },
// before the shared sign/min-max/rounding/tax pipeline in computeConditionAmount.
// ─────────────────────────────────────────────────────────────────────────

function evaluateFormula(f: FormulaRule, ctx: ConditionCalcContext): { raw: number; calcBase: number } {
  switch (f.type) {
    case 'FIXED':
      return { raw: f.value, calcBase: ctx.lineBaseValue };
    case 'PERCENTAGE':
      return { raw: (f.value / 100) * ctx.lineBaseValue, calcBase: ctx.lineBaseValue };
    case 'RATE_X_QTY':
      return { raw: f.value * ctx.lineQty, calcBase: ctx.lineBaseValue };
    case 'RATE_X_WEIGHT':
      return { raw: f.value * (ctx.lineQty * ctx.unitWeightKg), calcBase: ctx.lineBaseValue };
    case 'RATE_X_VOLUME':
      return { raw: f.value * (ctx.lineQty * ctx.unitVolumeCbm), calcBase: ctx.lineBaseValue };
  }
}

function evaluateSelectedSteps(steps: SelectedStep[], ctx: ConditionCalcContext): number {
  return steps.reduce((sum, step) => {
    const stepValue =
      step.source === 'BASE'
        ? ctx.lineBaseValue
        : step.valueKind === 'CONDITION_BASE'
          ? (ctx.priorBases?.[step.conditionCode ?? ''] ?? 0)
          : (ctx.priorAmounts[step.conditionCode ?? ''] ?? 0);
    const weighted = stepValue * ((step.percentage ?? 100) / 100);
    return step.operator === '-' ? sum - weighted : sum + weighted;
  }, 0);
}

// A SELECTED_CONDITIONS rule only builds the *base*; the condition's own Calculation
// Basis + Rate (Section 2 of the form — unchanged by this rule model) still decides
// how that base becomes an amount, exactly as the legacy "Calculate On -> Selected
// steps" behaviour always worked.
function applyLegacyBasisToBase(
  cond: Pick<AppliedCondition, 'calcBasis' | 'rate'>,
  calcBase: number,
  ctx: ConditionCalcContext
): { raw: number; calcBase: number } {
  switch (cond.calcBasis) {
    case 'FIXED_PER_PO':
    case 'FIXED_PER_LINE':
      return { raw: cond.rate, calcBase };
    case 'RATE_X_QTY':
      return { raw: cond.rate * ctx.lineQty, calcBase };
    case 'RATE_X_WEIGHT':
      return { raw: cond.rate * (ctx.lineQty * ctx.unitWeightKg), calcBase };
    case 'RATE_X_VOLUME':
      return { raw: cond.rate * (ctx.lineQty * ctx.unitVolumeCbm), calcBase };
    case 'PCT_OF_LINE_BASE':
      return { raw: (cond.rate / 100) * ctx.lineBaseValue, calcBase };
    case 'PCT_OF_SELECTED_BASE':
    default:
      return { raw: (cond.rate / 100) * calcBase, calcBase };
  }
}

function resolveFieldValue(field: RuleField, ctx: ConditionCalcContext): string | number | undefined {
  return resolveFieldValueImpl(field, ctx);
}

function compareValues(left: string | number | undefined, operator: RuleClause['operator'], value: RuleClause['value']): boolean {
  switch (operator) {
    case 'IS_EMPTY':
      return left === undefined || left === '' || left === null;
    case 'IS_NOT_EMPTY':
      return !(left === undefined || left === '' || left === null);
    case 'IN':
      return String(value ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(String(left ?? ''));
    case 'NOT_IN':
      return !String(value ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(String(left ?? ''));
    case 'BETWEEN': {
      if (!Array.isArray(value)) return false;
      const [a, b] = value;
      const n = Number(left);
      return n >= Number(a) && n <= Number(b);
    }
    case '=':
      return String(left ?? '') === String(value ?? '');
    case '!=':
      return String(left ?? '') !== String(value ?? '');
    case '>':
      return Number(left) > Number(value);
    case '<':
      return Number(left) < Number(value);
    case '>=':
      return Number(left) >= Number(value);
    case '<=':
      return Number(left) <= Number(value);
    default:
      return false;
  }
}

// Left-to-right fold of AND/OR — no operator precedence — intentionally: the UI
// is a flat chain of clauses (§13/§18 "no formula language"), not an expression tree.
export function evaluateClauses(clauses: RuleClause[], ctx: ConditionCalcContext): boolean {
  if (clauses.length === 0) return true;
  let result = compareValues(resolveFieldValue(clauses[0].field, ctx), clauses[0].operator, clauses[0].value);
  for (let i = 1; i < clauses.length; i++) {
    const join = clauses[i - 1].join ?? 'AND';
    const cur = compareValues(resolveFieldValue(clauses[i].field, ctx), clauses[i].operator, clauses[i].value);
    result = join === 'OR' ? result || cur : result && cur;
  }
  return result;
}

function matchTier(tiers: SlabTier[], driver: number): SlabTier | undefined {
  return tiers.find((t) => driver >= t.from && (t.to == null || driver < t.to)) ?? tiers[tiers.length - 1];
}

function tierAmount(tier: SlabTier | undefined, driver: number, base: number): number {
  if (!tier) return 0;
  return tier.rateType === 'PERCENTAGE' ? (tier.rate / 100) * base : tier.rate * driver;
}

function slabDriver(basis: string, ctx: ConditionCalcContext): number {
  switch (basis) {
    case 'QUANTITY':
    case 'CUMULATIVE_QUANTITY':
      return ctx.lineQty;
    case 'WEIGHT':
      return ctx.lineQty * ctx.unitWeightKg;
    case 'VOLUME':
      return ctx.lineQty * ctx.unitVolumeCbm;
    case 'PO_AMOUNT':
      return ctx.poBaseAmount ?? ctx.lineBaseValue;
    case 'DATE_RANGE':
      // Tiers store from/to as epoch-ms date bounds when basis is DATE_RANGE — match
      // against "now" (the effective calculation date; there's no separate PO/GRN date
      // context wired into ConditionCalcContext yet, so this is the current date).
      return Date.now();
    case 'BASE_AMOUNT':
    default:
      return ctx.lineBaseValue;
  }
}

// No historical/blanket-PO backend exists in this prototype — this is an explicit mock
// per the spec's allowance ("actual historical data source may be mocked"). It always
// returns 0 (current period only), which keeps CUMULATIVE rules exercising the same
// tier-matching logic as SLAB while making the mock impossible to mistake for real data.
function getCumulativeHistoryTotal(): number {
  return 0;
}

function computeRuleRaw(cond: AppliedCondition, rule: CalculationRule, ctx: ConditionCalcContext): { raw: number; calcBase: number; formula?: FormulaRule; branch?: 'THEN' | 'ELSE' } {
  switch (rule.mode) {
    case 'BASE':
      return { ...evaluateFormula(rule.base, ctx), formula: rule.base };
    case 'DIRECT':
      return { ...evaluateFormula(rule.direct, ctx), formula: rule.direct };
    case 'SELECTED_CONDITIONS': {
      const calcBase = evaluateSelectedSteps(rule.selected.steps, ctx);
      return applyLegacyBasisToBase(cond, calcBase, ctx);
    }
    case 'CONDITIONAL': {
      const matched = evaluateClauses(rule.conditional.clauses, ctx);
      const branch: 'THEN' | 'ELSE' = matched || !rule.conditional.else ? 'THEN' : 'ELSE';
      const formula = matched ? rule.conditional.then : (rule.conditional.else ?? rule.conditional.then);
      return { ...evaluateFormula(formula, ctx), formula, branch };
    }
    case 'SLAB': {
      const driver = slabDriver(rule.slab.basis, ctx);
      const tier = matchTier(rule.slab.tiers, driver);
      if (rule.slab.basis === 'DATE_RANGE') {
        // A date-range tier's rate is the amount/percentage that applies for that
        // window — not multiplied by the (meaningless-as-a-multiplier) date driver.
        const raw = tier ? (tier.rateType === 'PERCENTAGE' ? (tier.rate / 100) * ctx.lineBaseValue : tier.rate) : 0;
        return { raw, calcBase: ctx.lineBaseValue };
      }
      return { raw: tierAmount(tier, driver, driver), calcBase: driver };
    }
    case 'CUMULATIVE': {
      const current = cumulativeCurrentDriver(rule.cumulative.basis, ctx);
      const total = current + getCumulativeHistoryTotal();
      const tier = matchTier(rule.cumulative.tiers, total);
      return { raw: tierAmount(tier, current, ctx.lineBaseValue), calcBase: total };
    }
  }
}

function cumulativeCurrentDriver(basis: string, ctx: ConditionCalcContext): number {
  switch (basis) {
    case 'VALUE':
      return ctx.lineBaseValue;
    case 'WEIGHT':
      return ctx.lineQty * ctx.unitWeightKg;
    case 'VOLUME':
      return ctx.lineQty * ctx.unitVolumeCbm;
    case 'QUANTITY':
    default:
      return ctx.lineQty;
  }
}

function matchSlabRow(cond: AppliedCondition, driver: number) {
  // Legacy Condition Master `slabTable` (from/to/rate, no open-ended `to`) — kept
  // exactly as before for any condition saved before the SLAB rule mode existed.
  const table = cond.slabTable as { from: number; to: number; rate: number }[] | undefined;
  if (!table || table.length === 0) return undefined;
  return table.find((r) => driver >= r.from && driver < r.to) ?? table[table.length - 1];
}

// Legacy Calculate-On path — byte-for-byte the original engine (calcBasis switch
// fed by a plain weighted sum of calculateOnCodes) for any condition saved before
// the calculationMode/calculationRule model existed. Left untouched so existing
// Condition Masters and every seeded PO keep computing identically.
function computeLegacyRaw(cond: AppliedCondition, ctx: ConditionCalcContext): { raw: number; calcBase: number } {
  const resolveCalcBase = () => {
    if (cond.calculateOn === 'LINE_BASE') return ctx.lineBaseValue;
    const weights = cond.calculateOnWeights ?? {};
    return cond.calculateOnCodes.reduce((sum, code) => {
      const stepAmount = code === BASE_STEP ? ctx.lineBaseValue : (ctx.priorAmounts[code] ?? 0);
      const weightPct = weights[code] ?? 100;
      return sum + stepAmount * (weightPct / 100);
    }, 0);
  };

  const calcBase = resolveCalcBase();
  let raw = 0;

  switch (cond.calcBasis) {
    case 'FIXED_PER_PO':
    case 'FIXED_PER_LINE':
      raw = cond.rate;
      break;
    case 'RATE_X_QTY':
      raw = cond.rate * ctx.lineQty;
      break;
    case 'PCT_OF_LINE_BASE':
      raw = (cond.rate / 100) * ctx.lineBaseValue;
      break;
    case 'PCT_OF_SELECTED_BASE':
      raw = (cond.rate / 100) * calcBase;
      break;
    case 'RATE_X_WEIGHT':
      raw = cond.rate * (ctx.lineQty * ctx.unitWeightKg);
      break;
    case 'RATE_X_VOLUME':
      raw = cond.rate * (ctx.lineQty * ctx.unitVolumeCbm);
      break;
    case 'SLAB': {
      const driver = cond.calculateOn === 'SELECTED' ? calcBase : ctx.lineQty;
      const row = matchSlabRow(cond, driver);
      raw = row ? (row.rate / 100) * calcBase : 0;
      break;
    }
  }

  return { raw, calcBase };
}

export function computeConditionAmount(
  cond: AppliedCondition,
  ctx: ConditionCalcContext
): { amount: number; gstAmount: number; calcBase: number; effectiveFormula?: FormulaRule; conditionalBranch?: 'THEN' | 'ELSE'; chargeClamped?: boolean } {
  const { raw, calcBase, formula, branch } =
    cond.calculationMode && cond.calculationRule
      ? computeRuleRaw(cond, cond.calculationRule, ctx)
      : { ...computeLegacyRaw(cond, ctx), formula: undefined, branch: undefined };

  // Order (spec): 1) calc base  2) raw amount  3) min/max charge  4) sign  5) rounding  6) tax.
  let magnitude = Math.abs(raw);
  let chargeClamped = false;
  if (cond.minChargeAmount != null && magnitude < cond.minChargeAmount) {
    magnitude = cond.minChargeAmount;
    chargeClamped = true;
  }
  if (cond.maxChargeAmount != null && magnitude > cond.maxChargeAmount) {
    magnitude = cond.maxChargeAmount;
    chargeClamped = true;
  }

  const signed = cond.sign === '-' ? -magnitude : magnitude;
  const amount = roundAmount(signed, cond.rounding);

  const gstBase = Math.abs(amount);
  const gstAmount =
    cond.gstTreatment === 'EXEMPT' || cond.gstTreatment === 'NIL_RATED'
      ? 0
      : Math.round(gstBase * (cond.gstRate / 100) * 100) / 100;

  return { amount, gstAmount, calcBase, effectiveFormula: formula, conditionalBranch: branch, chargeClamped };
}

function jurisdictionFor(
  vendorId: string | undefined,
  vendors: Vendor[],
  deliveryState: string,
  gstTreatment: AppliedCondition['gstTreatment']
): 'CGST_SGST' | 'CGST_UTGST' | 'IGST' | 'RCM' | 'NONE' {
  if (gstTreatment === 'EXEMPT' || gstTreatment === 'NIL_RATED') return 'NONE';
  if (gstTreatment === 'RCM') return 'RCM';
  const vendor = vendors.find((v) => v.id === vendorId);
  if (!vendor) return 'NONE';
  if (vendor.state === deliveryState) {
    return UNION_TERRITORIES.has(deliveryState) ? 'CGST_UTGST' : 'CGST_SGST';
  }
  return 'IGST';
}

function computeWithJurisdiction(
  cond: AppliedCondition,
  r: { amount: number; gstAmount: number; calcBase: number; effectiveFormula?: FormulaRule; conditionalBranch?: 'THEN' | 'ELSE'; chargeClamped?: boolean },
  vendors: Vendor[],
  deliveryState: string,
  ctx: ConditionCalcContext
): ComputedConditionLine {
  const jurisdiction = jurisdictionFor(cond.vendorId, vendors, deliveryState, cond.gstTreatment);
  let cgst = 0,
    sgst = 0,
    igst = 0,
    utgst = 0,
    rcmAmount = 0;
  if (jurisdiction === 'CGST_SGST') {
    cgst = Math.round((r.gstAmount / 2) * 100) / 100;
    sgst = r.gstAmount - cgst;
  } else if (jurisdiction === 'CGST_UTGST') {
    cgst = Math.round((r.gstAmount / 2) * 100) / 100;
    utgst = r.gstAmount - cgst;
  } else if (jurisdiction === 'IGST') {
    igst = r.gstAmount;
  } else if (jurisdiction === 'RCM') {
    rcmAmount = r.gstAmount;
  }
  return {
    ...cond,
    calcBaseUsed: r.calcBase,
    computedAmount: r.amount,
    computedGstAmount: r.gstAmount,
    jurisdiction,
    cgst,
    sgst,
    igst,
    utgst,
    rcmAmount,
    ctxQty: ctx.lineQty,
    ctxUnitWeightKg: ctx.unitWeightKg,
    ctxUnitVolumeCbm: ctx.unitVolumeCbm,
    effectiveFormula: r.effectiveFormula,
    conditionalBranch: r.conditionalBranch,
    chargeClamped: r.chargeClamped,
  };
}

export interface LineComputation {
  line: POLine;
  lineBaseValue: number;
  items: ComputedConditionLine[];
}

// `po` supplies delivery state (GST jurisdiction) plus the attribute snapshot a
// CONDITIONAL rule can reference (PO Base Amount, Incoterm, Vendor Group, Entity, ...).
export function computeLine(line: POLine, vendors: Vendor[], po: PurchaseOrder): LineComputation {
  const lineBaseValue = Math.round(line.qty * line.unitPrice * 100) / 100;
  const sorted = orderByDependency(line.conditions);
  const priorAmounts: Record<string, number> = {};
  const priorBases: Record<string, number> = {};
  const items: ComputedConditionLine[] = [];
  const poBaseAmount = po.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const vendorGroup = vendors.find((v) => v.id === po.vendorId)?.vendorGroup;
  for (const cond of sorted) {
    const ctx: ConditionCalcContext = {
      lineBaseValue,
      lineQty: line.qty,
      unitWeightKg: line.unitWeightKg,
      unitVolumeCbm: line.unitVolumeCbm,
      priorAmounts,
      priorBases,
      poBaseAmount,
      incoterm: po.incoterm,
      vendorGroup,
      entityId: po.entityId,
      currency: po.currency,
      deliveryState: po.deliveryState,
    };
    const r = computeConditionAmount(cond, ctx);
    priorAmounts[cond.conditionCode] = r.amount;
    priorBases[cond.conditionCode] = r.calcBase;
    items.push(computeWithJurisdiction(cond, r, vendors, po.deliveryState, ctx));
  }
  return { line, lineBaseValue, items };
}

export interface HeaderComputation {
  totalBaseValue: number;
  items: ComputedConditionLine[];
  distribution: Record<string, Record<string, number>>; // conditionId -> lineId -> amount
}

export function computeHeaderCascade(po: PurchaseOrder, vendors: Vendor[]): HeaderComputation {
  const totalBaseValue = po.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const sorted = orderByDependency(po.headerConditions);
  const priorAmounts: Record<string, number> = {};
  const priorBases: Record<string, number> = {};
  const items: ComputedConditionLine[] = [];
  const distribution: Record<string, Record<string, number>> = {};
  const vendorGroup = vendors.find((v) => v.id === po.vendorId)?.vendorGroup;

  for (const cond of sorted) {
    const affectedLines = po.lines.filter(
      (l) => !cond.applyToLineIds || cond.applyToLineIds.length === 0 || cond.applyToLineIds.includes(l.id)
    );
    const weightSum = affectedLines.reduce((s, l) => s + l.qty * l.unitWeightKg, 0);
    const volumeSum = affectedLines.reduce((s, l) => s + l.qty * l.unitVolumeCbm, 0);
    const qtySum = affectedLines.reduce((s, l) => s + l.qty, 0);

    const ctx: ConditionCalcContext = {
      lineBaseValue: totalBaseValue,
      lineQty: qtySum,
      unitWeightKg: qtySum > 0 ? weightSum / qtySum : 0,
      unitVolumeCbm: qtySum > 0 ? volumeSum / qtySum : 0,
      priorAmounts,
      priorBases,
      poBaseAmount: totalBaseValue,
      incoterm: po.incoterm,
      vendorGroup,
      entityId: po.entityId,
      currency: po.currency,
      deliveryState: po.deliveryState,
    };
    const r = computeConditionAmount(cond, ctx);
    priorAmounts[cond.conditionCode] = r.amount;
    priorBases[cond.conditionCode] = r.calcBase;
    const computed = computeWithJurisdiction(cond, r, vendors, po.deliveryState, ctx);
    items.push(computed);

    distribution[cond.id] = distributeAcrossLines(
      computed.computedAmount,
      affectedLines,
      cond.distributionBasis ?? 'VALUE'
    );
  }

  return { totalBaseValue, items, distribution };
}

export function distributeAcrossLines(
  amount: number,
  lines: POLine[],
  basis: DistributionBasis
): Record<string, number> {
  const out: Record<string, number> = {};
  if (lines.length === 0) return out;
  const weight = (l: POLine) => {
    switch (basis) {
      case 'VALUE':
        return l.qty * l.unitPrice;
      case 'QUANTITY':
        return l.qty;
      case 'WEIGHT':
        return l.qty * l.unitWeightKg;
      case 'VOLUME':
        return l.qty * l.unitVolumeCbm;
      case 'EQUAL':
        return 1;
    }
  };
  const total = lines.reduce((s, l) => s + weight(l), 0);
  lines.forEach((l) => {
    out[l.id] = total > 0 ? Math.round((amount * weight(l)) / total * 100) / 100 : 0;
  });
  return out;
}

export interface VendorPayable {
  vendorId: string;
  vendorName: string;
  amount: number;
  isRcm?: boolean;
}

export interface POComputation {
  lineComputations: LineComputation[];
  headerComputation: HeaderComputation;
  baseAmount: number;
  categoryTotals: Record<CategoryCode, number>;
  statisticalTotal: number;
  capitalisedTotal: number;
  landedCost: number;
  taxableValue: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  utgstTotal: number;
  rcmTotal: number;
  poTotal: number;
  vendorPayables: VendorPayable[];
}

export function computePO(po: PurchaseOrder, vendors: Vendor[]): POComputation {
  const lineComputations = po.lines.map((l) => computeLine(l, vendors, po));
  const headerComputation = computeHeaderCascade(po, vendors);

  const baseAmount = lineComputations.reduce((s, lc) => s + lc.lineBaseValue, 0);

  const categoryTotals: Record<CategoryCode, number> = {
    DISC: 0,
    SURC: 0,
    LOGI: 0,
    STAT: 0,
    DEDN: 0,
    OTHR: 0,
  };
  let statisticalTotal = 0;
  let capitalisedTotal = 0;
  let taxableValue = baseAmount;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let utgstTotal = 0;
  let rcmTotal = 0;

  const vendorMap = new Map<string, VendorPayable>();
  const addPayable = (vendorId: string, vendorName: string, amount: number, isRcm = false) => {
    const key = vendorId + (isRcm ? '::rcm' : '');
    const existing = vendorMap.get(key);
    if (existing) existing.amount += amount;
    else vendorMap.set(key, { vendorId, vendorName, amount, isRcm });
  };

  // Base line items go to the PO vendor.
  lineComputations.forEach((lc) => addPayable(po.vendorId, po.vendorName, lc.lineBaseValue));

  const allItems: ComputedConditionLine[] = [
    ...lineComputations.flatMap((lc) => lc.items),
    ...headerComputation.items,
  ];

  for (const item of allItems) {
    if (item.statistical) {
      statisticalTotal += item.computedAmount;
      continue; // does not affect PO total or vendor payable
    }
    categoryTotals[item.category] += item.computedAmount;
    if (item.capitalise) capitalisedTotal += item.computedAmount;
    taxableValue += item.computedAmount;
    cgstTotal += item.cgst;
    sgstTotal += item.sgst;
    igstTotal += item.igst;
    utgstTotal += item.utgst;
    rcmTotal += item.rcmAmount;

    addPayable(item.vendorId, item.vendorName, item.computedAmount + item.cgst + item.sgst + item.igst + item.utgst);
  }

  const poTotal = taxableValue + cgstTotal + sgstTotal + igstTotal + utgstTotal;
  const landedCost = baseAmount + capitalisedTotal;

  return {
    lineComputations,
    headerComputation,
    baseAmount,
    categoryTotals,
    statisticalTotal,
    capitalisedTotal,
    landedCost,
    taxableValue,
    cgstTotal,
    sgstTotal,
    igstTotal,
    utgstTotal,
    rcmTotal,
    poTotal,
    vendorPayables: Array.from(vendorMap.values()).filter((v) => Math.abs(v.amount) > 0.005),
  };
}

// Human-readable "5% × ₹1,00,000" style string for the cascade preview and calculation
// info popover. Reads item.ctxQty/ctxUnitWeightKg/ctxUnitVolumeCbm — the driver
// quantities computeWithJurisdiction actually multiplied against — rather than the
// condition's own qty field (RATE_X_QTY/WEIGHT/VOLUME ignore it).
export function describeCalculation(
  item: ComputedConditionLine,
  uomName: string | undefined,
  currency: string
): string {
  if (item.calculationMode && item.calculationRule) {
    const rule = item.calculationRule;
    if (rule.mode === 'SLAB' || rule.mode === 'CUMULATIVE') {
      return `Tier band × ${formatCurrency(item.calcBaseUsed, currency)}`;
    }
    if (rule.mode === 'SELECTED_CONDITIONS') {
      return `${item.rate}% × ${formatCurrency(item.calcBaseUsed, currency)}`;
    }
    const f = item.effectiveFormula;
    const prefix = rule.mode === 'CONDITIONAL' ? `IF ${item.conditionalBranch === 'ELSE' ? 'false → ELSE: ' : 'true → THEN: '}` : '';
    if (!f) return prefix || '—';
    switch (f.type) {
      case 'FIXED':
        return `${prefix}Flat ${formatCurrency(f.value, currency)}`;
      case 'PERCENTAGE':
        return `${prefix}${f.value}% × ${formatCurrency(item.calcBaseUsed, currency)}`;
      case 'RATE_X_QTY':
        return `${prefix}${f.value} × ${item.ctxQty}${uomName ? ' ' + uomName : ''}`;
      case 'RATE_X_WEIGHT': {
        const total = item.ctxQty * item.ctxUnitWeightKg;
        return `${prefix}${f.value} × ${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${uomName ? ' ' + uomName : ' KG'}`;
      }
      case 'RATE_X_VOLUME': {
        const total = item.ctxQty * item.ctxUnitVolumeCbm;
        return `${prefix}${f.value} × ${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${uomName ? ' ' + uomName : ' CBM'}`;
      }
    }
  }

  switch (item.calcBasis) {
    case 'FIXED_PER_PO':
    case 'FIXED_PER_LINE':
      return `Flat ${formatCurrency(item.rate, currency)}`;
    case 'RATE_X_QTY':
      return `${item.rate} × ${item.ctxQty}${uomName ? ' ' + uomName : ''}`;
    case 'PCT_OF_LINE_BASE':
    case 'PCT_OF_SELECTED_BASE':
      return `${item.rate}% × ${formatCurrency(item.calcBaseUsed, currency)}`;
    case 'RATE_X_WEIGHT': {
      const total = item.ctxQty * item.ctxUnitWeightKg;
      return `${item.rate} × ${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${uomName ? ' ' + uomName : ' KG'}`;
    }
    case 'RATE_X_VOLUME': {
      const total = item.ctxQty * item.ctxUnitVolumeCbm;
      return `${item.rate} × ${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${uomName ? ' ' + uomName : ' CBM'}`;
    }
    case 'SLAB':
      return `Slab band × ${formatCurrency(item.calcBaseUsed, currency)}`;
    default:
      return '—';
  }
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency + ' ';
  const rounded = Math.round(amount * 100) / 100;
  const formatted = Math.abs(rounded).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: rounded % 1 === 0 ? 0 : 2 });
  return `${rounded < 0 ? '−' : ''}${symbol}${formatted}`;
}
