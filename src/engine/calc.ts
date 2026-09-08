import type {
  AppliedCondition,
  CategoryCode,
  DistributionBasis,
  POLine,
  PurchaseOrder,
  RoundingRule,
  Vendor,
} from '../types';

// Sentinel used inside AppliedCondition.calculateOnCodes to represent
// "line base value" as one of the selectable steps in a Calculate-On chain
// (PRD §5.2 / §6 — "Base + 10,20,30" vs "50 only").
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
}

function matchSlabRow(cond: AppliedCondition, driver: number) {
  // slabTable travels on the condition snapshot when present (P2 feature)
  const table = (cond as any).slabTable as { from: number; to: number; rate: number }[] | undefined;
  if (!table || table.length === 0) return undefined;
  return table.find((r) => driver >= r.from && driver < r.to) ?? table[table.length - 1];
}

export function computeConditionAmount(
  cond: AppliedCondition,
  ctx: ConditionCalcContext
): { amount: number; gstAmount: number; calcBase: number } {
  const resolveCalcBase = () => {
    if (cond.calculateOn === 'LINE_BASE') return ctx.lineBaseValue;
    return cond.calculateOnCodes.reduce((sum, code) => {
      if (code === BASE_STEP) return sum + ctx.lineBaseValue;
      return sum + (ctx.priorAmounts[code] ?? 0);
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

  const signed = cond.sign === '-' ? -Math.abs(raw) : Math.abs(raw);
  const amount = roundAmount(signed, cond.rounding);

  const gstBase = Math.abs(amount);
  const gstAmount =
    cond.gstTreatment === 'EXEMPT' || cond.gstTreatment === 'NIL_RATED'
      ? 0
      : Math.round(gstBase * (cond.gstRate / 100) * 100) / 100;

  return { amount, gstAmount, calcBase };
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
  r: { amount: number; gstAmount: number; calcBase: number },
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
  };
}

export interface LineComputation {
  line: POLine;
  lineBaseValue: number;
  items: ComputedConditionLine[];
}

export function computeLine(line: POLine, vendors: Vendor[], deliveryState: string): LineComputation {
  const lineBaseValue = Math.round(line.qty * line.unitPrice * 100) / 100;
  const sorted = [...line.conditions].sort((a, b) => a.sequence - b.sequence);
  const priorAmounts: Record<string, number> = {};
  const items: ComputedConditionLine[] = [];
  for (const cond of sorted) {
    const ctx: ConditionCalcContext = {
      lineBaseValue,
      lineQty: line.qty,
      unitWeightKg: line.unitWeightKg,
      unitVolumeCbm: line.unitVolumeCbm,
      priorAmounts,
    };
    const r = computeConditionAmount(cond, ctx);
    priorAmounts[cond.conditionCode] = r.amount;
    items.push(computeWithJurisdiction(cond, r, vendors, deliveryState, ctx));
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
  const sorted = [...po.headerConditions].sort((a, b) => a.sequence - b.sequence);
  const priorAmounts: Record<string, number> = {};
  const items: ComputedConditionLine[] = [];
  const distribution: Record<string, Record<string, number>> = {};

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
    };
    const r = computeConditionAmount(cond, ctx);
    priorAmounts[cond.conditionCode] = r.amount;
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
  const lineComputations = po.lines.map((l) => computeLine(l, vendors, po.deliveryState));
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
// info popover (20-domain/worked-examples.md format). Reads item.ctxQty/ctxUnitWeightKg/
// ctxUnitVolumeCbm — the driver quantities computeWithJurisdiction actually multiplied
// against — rather than the condition's own qty field (RATE_X_QTY/WEIGHT/VOLUME ignore it).
export function describeCalculation(
  item: ComputedConditionLine,
  uomName: string | undefined,
  currency: string
): string {
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
