// PO Condition Calculation Engine — dependency-graph edition.
//
// Implements DICE_PO_Condition_Calculation_Engine.txt: calculation order is
// derived from each condition's `calculateOn` / `calculateOnCodes` (its
// declared dependencies), never from a sequence number. See §2, §9-11, §37.
//
// This is a new, additive module — it does not replace or alter
// src/engine/calc.ts, which the rest of the app (AddConditionModal, GRNTab,
// InvoiceTab, ConditionCalcModal) continues to use unchanged.

import {
  BASE_STEP,
  type ComputedCondition,
  type DagCondition,
  type DagLine,
  type DagPurchaseOrder,
  type Jurisdiction,
  type RoundingRule,
  type Vendor,
} from './types';

const UNION_TERRITORIES = new Set([
  'Chandigarh',
  'Delhi',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
  'Andaman and Nicobar Islands',
  'Dadra and Nagar Haveli and Daman and Diu',
]);

export class CalculationError extends Error {}

// ---------------------------------------------------------------------------
// §10-11: dependency graph, topological sort, circular-dependency detection
// ---------------------------------------------------------------------------

/** Adjacency: conditionCode -> the (non-BASE) condition codes it depends on. */
export function buildConditionDependencyGraph(conditions: DagCondition[]): Map<string, string[]> {
  const codes = new Set(conditions.map((c) => c.conditionCode));
  const graph = new Map<string, string[]>();

  for (const cond of conditions) {
    const deps = cond.calculateOn === 'SELECTED' ? cond.calculateOnCodes : [];
    const edges: string[] = [];
    for (const dep of deps) {
      if (dep === BASE_STEP) continue;
      if (dep === cond.conditionCode) {
        throw new CalculationError(
          `Condition "${cond.conditionCode}" cannot depend on itself (Calculate On -> Selected steps).`
        );
      }
      if (!codes.has(dep)) {
        throw new CalculationError(
          `Condition "${cond.conditionCode}" references unknown/missing dependency "${dep}". ` +
            `Missing dependencies are errors, not zero amounts (rule §37.19).`
        );
      }
      edges.push(dep);
    }
    graph.set(cond.conditionCode, edges);
  }
  return graph;
}

/** Throws CalculationError with the offending cycle path if one exists. */
export function detectCircularDependencies(graph: Map<string, string[]>): void {
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
        const cycleStart = path.indexOf(dep);
        const cycle = [...path.slice(cycleStart), dep];
        throw new CalculationError(`Circular calculation dependency detected: ${cycle.join(' → ')}`);
      }
      if (depState === WHITE) visit(dep);
    }
    path.pop();
    state.set(code, BLACK);
  };

  for (const code of graph.keys()) {
    if (state.get(code) === WHITE) visit(code);
  }
}

/** Deterministic (alphabetical tie-break) topological order — dependencies before dependents. */
export function topologicalSortConditions(conditions: DagCondition[]): DagCondition[] {
  const graph = buildConditionDependencyGraph(conditions);
  detectCircularDependencies(graph);

  const byCode = new Map(conditions.map((c) => [c.conditionCode, c]));
  const visited = new Set<string>();
  const order: DagCondition[] = [];

  const sortedCodes = [...byCode.keys()].sort();

  const visit = (code: string) => {
    if (visited.has(code)) return;
    visited.add(code);
    for (const dep of [...(graph.get(code) ?? [])].sort()) visit(dep);
    order.push(byCode.get(code)!);
  };

  for (const code of sortedCodes) visit(code);
  return order;
}

// ---------------------------------------------------------------------------
// §4 line base, §6-7 sign/rounding, §5 calculation basis formulas
// ---------------------------------------------------------------------------

export function calculateLineBase(line: DagLine): number {
  return Math.round(line.qty * line.unitPrice * 100) / 100;
}

export function applySign(rawAmount: number, sign: '+' | '-'): number {
  const abs = Math.abs(rawAmount);
  return sign === '-' ? -abs : abs;
}

export function applyRounding(value: number, rule: RoundingRule): number {
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

/** §9: sums BASE + each explicitly selected condition's already-computed signed amount. */
export function resolveSelectedBase(
  cond: DagCondition,
  lineOrPoBase: number,
  priorAmounts: Record<string, number>
): { base: number; dependencyAmounts: Record<string, number> } {
  if (cond.calculateOn === 'LINE_BASE') {
    return { base: lineOrPoBase, dependencyAmounts: { [BASE_STEP]: lineOrPoBase } };
  }
  const dependencyAmounts: Record<string, number> = {};
  let base = 0;
  for (const code of cond.calculateOnCodes) {
    if (code === BASE_STEP) {
      dependencyAmounts[BASE_STEP] = lineOrPoBase;
      base += lineOrPoBase;
      continue;
    }
    // Missing dependencies were already rejected by buildConditionDependencyGraph,
    // so priorAmounts[code] is guaranteed to exist once callers sort topologically.
    const amt = priorAmounts[code] ?? 0;
    dependencyAmounts[code] = amt;
    base += amt;
  }
  return { base, dependencyAmounts };
}

function resolveSlabDriver(
  cond: DagCondition,
  selectedBase: number,
  qty: number,
  weight: number,
  volume: number
): number {
  const basis = cond.slabDriverBasis ?? (cond.calculateOn === 'SELECTED' ? 'SELECTED_BASE' : 'QTY');
  switch (basis) {
    case 'QTY':
      return qty;
    case 'WEIGHT':
      return qty * weight;
    case 'VOLUME':
      return qty * volume;
    case 'SELECTED_BASE':
      return selectedBase;
  }
}

function matchSlabRow(cond: DagCondition, driver: number) {
  const table = cond.slabTable ?? [];
  if (table.length === 0) {
    throw new CalculationError(`Condition "${cond.conditionCode}" has calcBasis SLAB but no slabTable rows.`);
  }
  return table.find((r) => driver >= r.from && driver < r.to) ?? table[table.length - 1];
}

export interface ConditionCalcContext {
  baseAmount: number; // line base (LINE-level) or PO-wide base (HEADER-level)
  qty: number;
  unitWeightKg: number;
  unitVolumeCbm: number;
  priorAmounts: Record<string, number>; // conditionCode -> already-computed signed+rounded amount
}

/** §5-7: the pure per-condition formula. Sign and rounding applied in that order, matching §37.7. */
export function calculateConditionAmount(
  cond: DagCondition,
  ctx: ConditionCalcContext
): { raw: number; signed: number; rounded: number; calcBase: number; dependencyAmounts: Record<string, number> } {
  const { base: selectedBase, dependencyAmounts } = resolveSelectedBase(cond, ctx.baseAmount, ctx.priorAmounts);

  let raw: number;
  switch (cond.calcBasis) {
    case 'FIXED_PER_PO':
    case 'FIXED_PER_LINE':
      // §5 FIXED_PER_LINE: "Quantity is effectively 1 and must not multiply the amount."
      raw = cond.rate;
      break;
    case 'RATE_X_QTY':
      raw = cond.rate * ctx.qty;
      break;
    case 'PCT_OF_LINE_BASE':
      raw = (cond.rate / 100) * ctx.baseAmount;
      break;
    case 'PCT_OF_SELECTED_BASE':
      raw = (cond.rate / 100) * selectedBase;
      break;
    case 'RATE_X_WEIGHT':
      if (!ctx.unitWeightKg) {
        throw new CalculationError(
          `Condition "${cond.conditionCode}" is RATE_X_WEIGHT but has no unit weight (§37.14: missing item-master data is a hard error).`
        );
      }
      raw = cond.rate * (ctx.qty * ctx.unitWeightKg);
      break;
    case 'RATE_X_VOLUME':
      if (!ctx.unitVolumeCbm) {
        throw new CalculationError(
          `Condition "${cond.conditionCode}" is RATE_X_VOLUME but has no unit volume (§37.14: missing item-master data is a hard error).`
        );
      }
      raw = cond.rate * (ctx.qty * ctx.unitVolumeCbm);
      break;
    case 'SLAB': {
      const driver = resolveSlabDriver(cond, selectedBase, ctx.qty, ctx.unitWeightKg, ctx.unitVolumeCbm);
      const row = matchSlabRow(cond, driver);
      raw = row.rate * driver; // slab rows carry a flat per-unit rate, not a percentage
      break;
    }
  }

  const signed = applySign(raw, cond.sign);
  const rounded = applyRounding(signed, cond.rounding);
  return { raw, signed, rounded, calcBase: selectedBase, dependencyAmounts };
}

// ---------------------------------------------------------------------------
// §19-22: tax
// ---------------------------------------------------------------------------

export function calculateConditionTax(
  cond: DagCondition,
  roundedAmount: number,
  priorAmounts: Record<string, number>
): number {
  if (cond.gstTreatment === 'EXEMPT' || cond.gstTreatment === 'NIL_RATED') return 0;

  let gstBase = Math.abs(roundedAmount);
  if (cond.taxCalculatedOn === 'CONDITION_PLUS_SELECTED') {
    for (const code of cond.taxBaseCodes ?? []) {
      gstBase += Math.abs(priorAmounts[code] ?? 0);
    }
  }
  return Math.round(gstBase * (cond.gstRate / 100) * 100) / 100;
}

function jurisdictionFor(vendorId: string, vendors: Vendor[], deliveryState: string, gstTreatment: DagCondition['gstTreatment']): Jurisdiction {
  if (gstTreatment === 'EXEMPT' || gstTreatment === 'NIL_RATED') return 'NONE';
  if (gstTreatment === 'RCM') return 'RCM';
  const vendor = vendors.find((v) => v.id === vendorId);
  if (!vendor) return 'NONE';
  if (vendor.state === deliveryState) {
    return UNION_TERRITORIES.has(deliveryState) ? 'CGST_UTGST' : 'CGST_SGST';
  }
  return 'IGST';
}

function splitGst(gstAmount: number, jurisdiction: Jurisdiction) {
  let cgst = 0,
    sgst = 0,
    igst = 0,
    utgst = 0,
    rcmAmount = 0;
  if (jurisdiction === 'CGST_SGST') {
    cgst = Math.round((gstAmount / 2) * 100) / 100;
    sgst = gstAmount - cgst;
  } else if (jurisdiction === 'CGST_UTGST') {
    cgst = Math.round((gstAmount / 2) * 100) / 100;
    utgst = gstAmount - cgst;
  } else if (jurisdiction === 'IGST') {
    igst = gstAmount;
  } else if (jurisdiction === 'RCM') {
    rcmAmount = gstAmount;
  }
  return { cgst, sgst, igst, utgst, rcmAmount };
}

// ---------------------------------------------------------------------------
// Single-scope evaluator: runs the full pipeline (§32 steps 4-11) over one
// dependency graph — either one line's LINE conditions, or all HEADER
// conditions at PO scope. Cross-level dependencies are not supported, mirroring
// how the existing app already keeps line- and header-level cascades separate.
// ---------------------------------------------------------------------------

function evaluateConditionSet(
  conditions: DagCondition[],
  baseAmount: number,
  qty: number,
  unitWeightKg: number,
  unitVolumeCbm: number,
  vendors: Vendor[],
  deliveryState: string
): ComputedCondition[] {
  const ordered = topologicalSortConditions(conditions);
  const priorAmounts: Record<string, number> = {};
  const results: ComputedCondition[] = [];

  for (const cond of ordered) {
    const ctx: ConditionCalcContext = { baseAmount, qty, unitWeightKg, unitVolumeCbm, priorAmounts };
    const { raw, signed, rounded, calcBase, dependencyAmounts } = calculateConditionAmount(cond, ctx);
    priorAmounts[cond.conditionCode] = rounded;

    const gstAmount = calculateConditionTax(cond, rounded, priorAmounts);
    const jurisdiction = jurisdictionFor(cond.vendorId, vendors, deliveryState, cond.gstTreatment);
    const { cgst, sgst, igst, utgst, rcmAmount } = splitGst(gstAmount, jurisdiction);

    const vendorPayableAmount = cond.statistical
      ? 0
      : rounded + cgst + sgst + igst + utgst; // RCM GST excluded — rcmAmount is self-assessed, not vendor payable

    results.push({
      conditionCode: cond.conditionCode,
      calcBasis: cond.calcBasis,
      calculationBaseAmount: calcBase,
      dependencyAmounts,
      inputRate: cond.rate,
      inputQuantity: qty,
      inputWeight: unitWeightKg || undefined,
      inputVolume: unitVolumeCbm || undefined,
      rawAmount: raw,
      signedAmount: signed,
      roundedAmount: rounded,
      gstRate: cond.gstRate,
      gstAmount,
      jurisdiction,
      cgst,
      sgst,
      igst,
      utgst,
      rcmAmount,
      vendorId: cond.vendorId,
      vendorName: cond.vendorName,
      vendorPayableAmount,
      landedCostAmount: cond.capitalise ? rounded : 0,
      statistical: cond.statistical,
      capitalise: cond.capitalise,
      calculationBreakdown: describeCalculation(cond, raw, calcBase),
    });
  }

  return results;
}

export function describeCalculation(cond: DagCondition, rawAmount: number, calcBase: number): string {
  const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  switch (cond.calcBasis) {
    case 'FIXED_PER_PO':
    case 'FIXED_PER_LINE':
      return `Flat ${fmt(cond.rate)}`;
    case 'RATE_X_QTY':
      return `${cond.rate} × qty = ${fmt(rawAmount)}`;
    case 'PCT_OF_LINE_BASE':
    case 'PCT_OF_SELECTED_BASE':
      return `${cond.rate}% × ${fmt(calcBase)} = ${fmt(rawAmount)}`;
    case 'RATE_X_WEIGHT':
      return `${cond.rate}/KG × driver = ${fmt(rawAmount)}`;
    case 'RATE_X_VOLUME':
      return `${cond.rate}/CBM × driver = ${fmt(rawAmount)}`;
    case 'SLAB':
      return `Slab rate × driver = ${fmt(rawAmount)}`;
  }
}

// ---------------------------------------------------------------------------
// §17: header conditions + distribution to lines
// ---------------------------------------------------------------------------

export function distributeAcrossLines(
  amount: number,
  lines: DagLine[],
  basis: DagCondition['distributionBasis']
): Record<string, number> {
  const out: Record<string, number> = {};
  if (lines.length === 0) return out;
  const weight = (l: DagLine) => {
    switch (basis) {
      case 'QUANTITY':
        return l.qty;
      case 'WEIGHT':
        return l.qty * (l.unitWeightKg ?? 0);
      case 'VOLUME':
        return l.qty * (l.unitVolumeCbm ?? 0);
      case 'EQUAL':
        return 1;
      case 'VALUE':
      default:
        return l.qty * l.unitPrice;
    }
  };
  const total = lines.reduce((s, l) => s + weight(l), 0);
  if (total <= 0) {
    throw new CalculationError(
      `Cannot distribute condition amount across lines: total ${basis ?? 'VALUE'} weight is zero (§37.20).`
    );
  }
  lines.forEach((l) => {
    out[l.id] = Math.round(((amount * weight(l)) / total) * 100) / 100;
  });
  return out;
}

export interface HeaderComputation {
  totalBaseAmount: number;
  items: ComputedCondition[];
  distribution: Record<string, Record<string, number>>; // conditionCode -> lineId -> distributed amount
}

export function computeHeaderConditions(po: DagPurchaseOrder, vendors: Vendor[]): HeaderComputation {
  const totalBaseAmount = po.lines.reduce((s, l) => s + calculateLineBase(l), 0);

  // Header conditions are evaluated once at PO scope; a header condition may only
  // depend on BASE or on other header conditions (mirrors the existing app's
  // separation of line- vs header-level cascades).
  const items = evaluateConditionSet(po.headerConditions, totalBaseAmount, 0, 0, 0, vendors, po.deliveryState);

  const distribution: Record<string, Record<string, number>> = {};
  for (const cond of po.headerConditions) {
    const item = items.find((i) => i.conditionCode === cond.conditionCode)!;
    const affectedLines = po.lines.filter(
      (l) => !cond.applyToLineIds || cond.applyToLineIds.length === 0 || cond.applyToLineIds.includes(l.id)
    );
    distribution[cond.conditionCode] = distributeAcrossLines(item.roundedAmount, affectedLines, cond.distributionBasis);
  }

  return { totalBaseAmount, items, distribution };
}

// ---------------------------------------------------------------------------
// Line-level computation
// ---------------------------------------------------------------------------

export interface LineComputation {
  lineId: string;
  lineBaseAmount: number;
  items: ComputedCondition[];
  landedCostAmount: number; // lineBaseAmount + capitalised line-level condition amounts
  perUnitLandedCost: number;
}

export function computeLine(line: DagLine, vendors: Vendor[], deliveryState: string): LineComputation {
  const lineBaseAmount = calculateLineBase(line);
  const items = evaluateConditionSet(
    line.conditions,
    lineBaseAmount,
    line.qty,
    line.unitWeightKg ?? 0,
    line.unitVolumeCbm ?? 0,
    vendors,
    deliveryState
  );
  const capitalisedTotal = items.reduce((s, i) => s + i.landedCostAmount, 0);
  const landedCostAmount = lineBaseAmount + capitalisedTotal;
  const perUnitLandedCost = line.qty > 0 ? Math.round((landedCostAmount / line.qty) * 100) / 100 : 0;
  return { lineId: line.id, lineBaseAmount, items, landedCostAmount, perUnitLandedCost };
}

// ---------------------------------------------------------------------------
// §33-35: full PO computation — totals, landed cost, vendor payables
// ---------------------------------------------------------------------------

export interface VendorPayable {
  vendorId: string;
  vendorName: string;
  amount: number;
}

export interface POComputation {
  lineComputations: LineComputation[];
  headerComputation: HeaderComputation;

  grossItemValue: number;
  categoryTotals: Record<string, number>;
  statisticalTotal: number;

  taxableValue: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  utgstTotal: number;
  rcmTotal: number;
  conditionTaxTotal: number;

  poGrandTotal: number;
  vendorPayableTotal: number;
  vendorPayables: VendorPayable[];

  capitalisedLandedCost: number;
  perUnitLandedCostByLine: Record<string, number>;
}

export function computePO(po: DagPurchaseOrder, vendors: Vendor[]): POComputation {
  const lineComputations = po.lines.map((l) => computeLine(l, vendors, po.deliveryState));
  const headerComputation = computeHeaderConditions(po, vendors);

  const grossItemValue = lineComputations.reduce((s, lc) => s + lc.lineBaseAmount, 0);

  const categoryTotals: Record<string, number> = {};
  let statisticalTotal = 0;
  let taxableValue = grossItemValue;
  let cgstTotal = 0,
    sgstTotal = 0,
    igstTotal = 0,
    utgstTotal = 0,
    rcmTotal = 0;

  const vendorMap = new Map<string, VendorPayable>();
  const addPayable = (vendorId: string, vendorName: string, amount: number) => {
    if (Math.abs(amount) < 0.005) return;
    const existing = vendorMap.get(vendorId);
    if (existing) existing.amount += amount;
    else vendorMap.set(vendorId, { vendorId, vendorName, amount });
  };

  // §35: base line value is always payable to the PO vendor.
  lineComputations.forEach((lc) => addPayable(po.vendorId, po.vendorName, lc.lineBaseAmount));

  const allItems: { item: ComputedCondition; category: string }[] = [
    ...po.lines.flatMap((l, i) => l.conditions.map((c, j) => ({ item: lineComputations[i].items[j], category: c.category }))),
    ...po.headerConditions.map((c, j) => ({ item: headerComputation.items[j], category: c.category })),
  ];

  // §17: distribute header condition landed-cost contributions into each line's landed cost.
  const perLineHeaderCapitalised = new Map<string, number>();

  for (const { item, category } of allItems) {
    if (item.statistical) {
      // §8 / §28: still calculated for visibility, excluded from every total below.
      statisticalTotal += item.roundedAmount;
      continue;
    }
    categoryTotals[category] = (categoryTotals[category] ?? 0) + item.roundedAmount;
    taxableValue += item.roundedAmount;
    cgstTotal += item.cgst;
    sgstTotal += item.sgst;
    igstTotal += item.igst;
    utgstTotal += item.utgst;
    rcmTotal += item.rcmAmount;
    addPayable(item.vendorId, item.vendorName, item.vendorPayableAmount);
  }

  for (const cond of po.headerConditions) {
    if (!cond.capitalise) continue;
    const dist = headerComputation.distribution[cond.conditionCode] ?? {};
    for (const [lineId, amt] of Object.entries(dist)) {
      perLineHeaderCapitalised.set(lineId, (perLineHeaderCapitalised.get(lineId) ?? 0) + amt);
    }
  }

  const conditionTaxTotal = cgstTotal + sgstTotal + igstTotal + utgstTotal; // RCM excluded — self-assessed, not part of vendor-payable tax
  const poGrandTotal = taxableValue + conditionTaxTotal;
  const vendorPayableTotal = Array.from(vendorMap.values()).reduce((s, v) => s + v.amount, 0);

  // §15-16: per-line landed cost includes the line's own capitalised conditions
  // PLUS this line's distributed share of any capitalised header condition.
  const perUnitLandedCostByLine: Record<string, number> = {};
  let capitalisedLandedCost = 0;
  for (const lc of lineComputations) {
    const extra = perLineHeaderCapitalised.get(lc.lineId) ?? 0;
    const totalLandedCost = lc.landedCostAmount + extra;
    capitalisedLandedCost += totalLandedCost - lc.lineBaseAmount; // just the capitalised contribution, not the base
    const line = po.lines.find((l) => l.id === lc.lineId)!;
    perUnitLandedCostByLine[lc.lineId] = line.qty > 0 ? Math.round((totalLandedCost / line.qty) * 100) / 100 : 0;
  }
  capitalisedLandedCost = Math.round(capitalisedLandedCost * 100) / 100;

  return {
    lineComputations,
    headerComputation,
    grossItemValue,
    categoryTotals,
    statisticalTotal,
    taxableValue,
    cgstTotal,
    sgstTotal,
    igstTotal,
    utgstTotal,
    rcmTotal,
    conditionTaxTotal,
    poGrandTotal,
    vendorPayableTotal,
    vendorPayables: Array.from(vendorMap.values()),
    capitalisedLandedCost,
    perUnitLandedCostByLine,
  };
}

// §28: invoice/payment eligibility is a workflow gate, not a monetary calculation.
export function isEligibleForInvoice(cond: DagCondition): boolean {
  return !cond.requiresServiceConfirmation || cond.confirmed;
}
