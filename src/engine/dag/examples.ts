/// <reference types="node" />
// Worked examples from DICE_PO_Condition_Calculation_Engine.txt, reproduced as
// runnable assertions against the dependency-graph engine in ./calcEngine.ts.
//
// Run with:
//   npm run calc:examples
//
// Every example prints PASS/FAIL with the expected vs. actual figures from the
// spec, so you can see at a glance whether the engine matches the document.

import {
  computeHeaderConditions,
  computeLine,
  computePO,
  detectCircularDependencies,
  buildConditionDependencyGraph,
} from './calcEngine';
import { BASE_STEP, type DagCondition, type DagLine, type DagPurchaseOrder, type Vendor } from './types';

let pass = 0;
let fail = 0;

function approx(a: number, b: number, tol = 0.01): boolean {
  return Math.abs(a - b) <= tol;
}

function check(label: string, actual: number, expected: number): void {
  if (approx(actual, expected)) {
    pass++;
    console.log(`  PASS  ${label}: ${actual} (expected ${expected})`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}: ${actual} (expected ${expected})`);
  }
}

function checkThrows(label: string, fn: () => void, expectedSubstring?: string): void {
  try {
    fn();
    fail++;
    console.log(`  FAIL  ${label}: expected an error, but none was thrown`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!expectedSubstring || msg.includes(expectedSubstring)) {
      pass++;
      console.log(`  PASS  ${label}: threw as expected ("${msg}")`);
    } else {
      fail++;
      console.log(`  FAIL  ${label}: threw wrong error ("${msg}")`);
    }
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

const VENDORS: Vendor[] = [
  { id: 'po-vendor', name: 'Acme Components', state: 'Maharashtra' },
  { id: 'freight-vendor', name: 'Blue Dart Logistics', state: 'Karnataka' },
  { id: 'insurance-vendor', name: 'National Insurance Co', state: 'Maharashtra' },
];

function cond(overrides: Partial<DagCondition> & Pick<DagCondition, 'conditionCode' | 'calcBasis' | 'rate' | 'sign'>): DagCondition {
  return {
    id: overrides.conditionCode,
    conditionMasterVersion: 1,
    category: 'OTHR',
    level: 'LINE',
    uom: undefined,
    rounding: 'NORMAL',
    statistical: false,
    gstTreatment: 'DEDUCTIBLE',
    gstRate: 0,
    taxCalculatedOn: 'CONDITION_AMOUNT',
    vendorRule: 'SAME_AS_PO',
    vendorId: 'po-vendor',
    vendorName: 'Acme Components',
    calculateOn: 'LINE_BASE',
    calculateOnCodes: [],
    capitalise: false,
    allowedLevel: 'LINE',
    requiresServiceConfirmation: false,
    confirmed: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// §13: full cascading example — Discount, Freight, Insurance, Customs
// ---------------------------------------------------------------------------
section('§13 — Cascading example (Discount / Freight / Insurance / Customs)');
{
  const line: DagLine = {
    id: 'L1',
    qty: 100,
    unitPrice: 1000,
    conditions: [
      cond({ conditionCode: 'DISCOUNT', category: 'DISC', calcBasis: 'PCT_OF_LINE_BASE', rate: 5, sign: '-' }),
      cond({ conditionCode: 'FREIGHT', category: 'LOGI', calcBasis: 'PCT_OF_LINE_BASE', rate: 10, sign: '+' }),
      cond({
        conditionCode: 'INSURANCE',
        category: 'LOGI',
        calcBasis: 'PCT_OF_SELECTED_BASE',
        rate: 2,
        sign: '+',
        calculateOn: 'SELECTED',
        calculateOnCodes: [BASE_STEP, 'FREIGHT'],
      }),
      cond({
        conditionCode: 'CUSTOMS',
        category: 'STAT',
        calcBasis: 'PCT_OF_SELECTED_BASE',
        rate: 10,
        sign: '+',
        calculateOn: 'SELECTED',
        calculateOnCodes: [BASE_STEP, 'FREIGHT', 'INSURANCE'],
      }),
    ],
  };

  const result = computeLine(line, VENDORS, 'Maharashtra');
  const amounts = Object.fromEntries(result.items.map((i) => [i.conditionCode, i.roundedAmount]));

  check('LINE_BASE', result.lineBaseAmount, 100000);
  check('DISCOUNT', amounts.DISCOUNT, -5000);
  check('FREIGHT', amounts.FREIGHT, 10000);
  check('INSURANCE base (BASE+FREIGHT)', result.items.find((i) => i.conditionCode === 'INSURANCE')!.calculationBaseAmount, 110000);
  check('INSURANCE', amounts.INSURANCE, 2200);
  check('CUSTOMS base (BASE+FREIGHT+INSURANCE)', result.items.find((i) => i.conditionCode === 'CUSTOMS')!.calculationBaseAmount, 112200);
  check('CUSTOMS', amounts.CUSTOMS, 11220);

  const taxableValueAddition = amounts.DISCOUNT + amounts.FREIGHT + amounts.INSURANCE + amounts.CUSTOMS;
  check('Non-tax value added by conditions', taxableValueAddition, 18420);
  const totalTaxableValue = 100000 + taxableValueAddition;
  check('Total taxable value (base + conditions)', totalTaxableValue, 118420);

  // Illustrative aside from the spec: "if GST = 18%" applied to the combined
  // taxable value works out to ₹21,315.60. This is a narrative aggregate over
  // the net taxable value (not the engine's per-condition GST, which taxes
  // each condition's own amount individually per §19-20 — see the §33 example
  // below for that behaviour) — checked here as plain arithmetic, not an
  // engine call.
  check('Illustrative aggregate GST @ 18% on total taxable value', totalTaxableValue * 0.18, 21315.6);
}

// ---------------------------------------------------------------------------
// §15-16: landed cost / capitalisation, per-unit landed cost
// ---------------------------------------------------------------------------
section('§15-16 — Landed cost & per-unit landed cost');
{
  const line: DagLine = {
    id: 'L2',
    qty: 100,
    unitPrice: 1000,
    conditions: [
      cond({ conditionCode: 'FREIGHT', calcBasis: 'PCT_OF_LINE_BASE', rate: 10, sign: '+', capitalise: true }),
      cond({
        conditionCode: 'INSURANCE',
        calcBasis: 'PCT_OF_SELECTED_BASE',
        rate: 2,
        sign: '+',
        capitalise: true,
        calculateOn: 'SELECTED',
        calculateOnCodes: [BASE_STEP, 'FREIGHT'],
      }),
      cond({ conditionCode: 'DISCOUNT', calcBasis: 'PCT_OF_LINE_BASE', rate: 5, sign: '-', capitalise: true }),
    ],
  };
  const result = computeLine(line, VENDORS, 'Maharashtra');
  check('Landed cost (100,000 + 10,000 + 2,200 - 5,000)', result.landedCostAmount, 107200);
  check('Per-unit landed cost', result.perUnitLandedCost, 1072);
}
{
  const line: DagLine = {
    id: 'L3',
    qty: 100,
    unitPrice: 1000,
    conditions: [cond({ conditionCode: 'TOOLING', calcBasis: 'FIXED_PER_LINE', rate: 5000, sign: '+', capitalise: true })],
  };
  const result = computeLine(line, VENDORS, 'Maharashtra');
  const toolingContribution = result.items[0].landedCostAmount;
  check('Fixed tooling landed-cost contribution (not divided by qty first)', toolingContribution, 5000);
  check('Per-unit contribution of fixed tooling alone', toolingContribution / line.qty, 50);
}

// ---------------------------------------------------------------------------
// §17: header condition distribution across lines
// ---------------------------------------------------------------------------
section('§17 — Header condition distribution (VALUE basis)');
{
  const po: DagPurchaseOrder = {
    vendorId: 'po-vendor',
    vendorName: 'Acme Components',
    deliveryState: 'Maharashtra',
    lines: [
      { id: 'A', qty: 1, unitPrice: 100000, conditions: [] },
      { id: 'B', qty: 1, unitPrice: 200000, conditions: [] },
      { id: 'C', qty: 1, unitPrice: 700000, conditions: [] },
    ],
    headerConditions: [
      cond({
        conditionCode: 'OCEAN_FREIGHT',
        category: 'LOGI',
        level: 'HEADER',
        allowedLevel: 'HEADER',
        calcBasis: 'FIXED_PER_PO',
        rate: 50000,
        sign: '+',
        distributionBasis: 'VALUE',
        vendorId: 'freight-vendor',
        vendorName: 'Blue Dart Logistics',
        vendorRule: 'MUST_DIFFER',
      }),
    ],
  };
  const header = computeHeaderConditions(po, VENDORS);
  const dist = header.distribution.OCEAN_FREIGHT;
  check('Line A allocation', dist.A, 5000);
  check('Line B allocation', dist.B, 10000);
  check('Line C allocation', dist.C, 35000);
}

// ---------------------------------------------------------------------------
// §5 SLAB — weight-driven slab lookup
// ---------------------------------------------------------------------------
section('§5 — SLAB (weight driver)');
{
  const line: DagLine = {
    id: 'L4',
    qty: 100,
    unitPrice: 1000,
    unitWeightKg: 25, // total driver weight = 100 * 25 = 2500 KG
    conditions: [
      cond({
        conditionCode: 'SLAB_FREIGHT',
        calcBasis: 'SLAB',
        rate: 0,
        sign: '+',
        slabDriverBasis: 'WEIGHT',
        slabTable: [
          { from: 0, to: 999, rate: 10 },
          { from: 1000, to: 4999, rate: 8 },
          { from: 5000, to: Infinity, rate: 6 },
        ],
      }),
    ],
  };
  const result = computeLine(line, VENDORS, 'Maharashtra');
  check('SLAB amount (2500 KG @ ₹8/KG)', result.items[0].roundedAmount, 20000);
}

// ---------------------------------------------------------------------------
// §5 RATE_X_WEIGHT / RATE_X_VOLUME / RATE_X_QTY
// ---------------------------------------------------------------------------
section('§5 — RATE_X_WEIGHT / RATE_X_VOLUME / RATE_X_QTY');
{
  const line: DagLine = {
    id: 'L5',
    qty: 100,
    unitPrice: 1000,
    unitWeightKg: 25,
    unitVolumeCbm: 0.2,
    conditions: [
      cond({ conditionCode: 'WEIGHT_FREIGHT', calcBasis: 'RATE_X_WEIGHT', rate: 8, sign: '+' }),
      cond({ conditionCode: 'VOLUME_FREIGHT', calcBasis: 'RATE_X_VOLUME', rate: 500, sign: '+' }),
      cond({ conditionCode: 'HANDLING', calcBasis: 'RATE_X_QTY', rate: 20, sign: '+' }),
    ],
  };
  const result = computeLine(line, VENDORS, 'Maharashtra');
  const amounts = Object.fromEntries(result.items.map((i) => [i.conditionCode, i.roundedAmount]));
  check('RATE_X_WEIGHT (100 x 25KG x 8/KG)', amounts.WEIGHT_FREIGHT, 20000);
  check('RATE_X_VOLUME (100 x 0.2CBM x 500/CBM)', amounts.VOLUME_FREIGHT, 10000);
  check('RATE_X_QTY (100 x 20)', amounts.HANDLING, 2000);
}

// ---------------------------------------------------------------------------
// §11 circular dependency detection
// ---------------------------------------------------------------------------
section('§11 — Circular dependency detection');
{
  const conditions: DagCondition[] = [
    cond({
      conditionCode: 'FREIGHT',
      calcBasis: 'PCT_OF_SELECTED_BASE',
      rate: 10,
      sign: '+',
      calculateOn: 'SELECTED',
      calculateOnCodes: ['CUSTOMS'],
    }),
    cond({
      conditionCode: 'INSURANCE',
      calcBasis: 'PCT_OF_SELECTED_BASE',
      rate: 2,
      sign: '+',
      calculateOn: 'SELECTED',
      calculateOnCodes: ['FREIGHT'],
    }),
    cond({
      conditionCode: 'CUSTOMS',
      calcBasis: 'PCT_OF_SELECTED_BASE',
      rate: 10,
      sign: '+',
      calculateOn: 'SELECTED',
      calculateOnCodes: ['INSURANCE'],
    }),
  ];
  checkThrows('Freight -> Insurance -> Customs -> Freight cycle', () => {
    const graph = buildConditionDependencyGraph(conditions);
    detectCircularDependencies(graph);
  }, 'Circular calculation dependency detected');
}

// ---------------------------------------------------------------------------
// §37.19 missing dependency is a hard error, not a zero amount
// ---------------------------------------------------------------------------
section('§37.19 — Missing dependency is an error');
{
  const line: DagLine = {
    id: 'L6',
    qty: 10,
    unitPrice: 1000,
    conditions: [
      cond({
        conditionCode: 'INSURANCE',
        calcBasis: 'PCT_OF_SELECTED_BASE',
        rate: 2,
        sign: '+',
        calculateOn: 'SELECTED',
        calculateOnCodes: [BASE_STEP, 'FREIGHT'], // FREIGHT does not exist on this line
      }),
    ],
  };
  checkThrows('Insurance referencing non-existent Freight', () => computeLine(line, VENDORS, 'Maharashtra'), 'missing dependency');
}

// ---------------------------------------------------------------------------
// §37.3 a condition cannot depend on itself
// ---------------------------------------------------------------------------
section('§37.3 — Self-dependency is an error');
{
  const line: DagLine = {
    id: 'L7',
    qty: 10,
    unitPrice: 1000,
    conditions: [
      cond({
        conditionCode: 'INSURANCE',
        calcBasis: 'PCT_OF_SELECTED_BASE',
        rate: 2,
        sign: '+',
        calculateOn: 'SELECTED',
        calculateOnCodes: ['INSURANCE'],
      }),
    ],
  };
  checkThrows('Insurance referencing itself', () => computeLine(line, VENDORS, 'Maharashtra'), 'cannot depend on itself');
}

// ---------------------------------------------------------------------------
// §36 recalculation on PO change — no stale downstream values
// ---------------------------------------------------------------------------
section('§36 — Recalculation propagation (no stale values)');
{
  const buildLine = (freightRate: number): DagLine => ({
    id: 'L8',
    qty: 100,
    unitPrice: 1000,
    conditions: [
      cond({ conditionCode: 'FREIGHT', calcBasis: 'PCT_OF_LINE_BASE', rate: freightRate, sign: '+' }),
      cond({
        conditionCode: 'INSURANCE',
        calcBasis: 'PCT_OF_SELECTED_BASE',
        rate: 2,
        sign: '+',
        calculateOn: 'SELECTED',
        calculateOnCodes: [BASE_STEP, 'FREIGHT'],
      }),
    ],
  });

  const before = computeLine(buildLine(10), VENDORS, 'Maharashtra');
  check('Freight before change', before.items.find((i) => i.conditionCode === 'FREIGHT')!.roundedAmount, 10000);
  check('Insurance before change (2% of 110,000)', before.items.find((i) => i.conditionCode === 'INSURANCE')!.roundedAmount, 2200);

  // Freight rate moves so its amount goes from 10,000 -> 12,000; Insurance must
  // re-derive from the NEW freight amount, not the stale 10,000 from `before`.
  const after = computeLine(buildLine(12), VENDORS, 'Maharashtra');
  check('Freight after change', after.items.find((i) => i.conditionCode === 'FREIGHT')!.roundedAmount, 12000);
  check('Insurance after change (2% of 112,000)', after.items.find((i) => i.conditionCode === 'INSURANCE')!.roundedAmount, 2240);
}

// ---------------------------------------------------------------------------
// §8 statistical conditions excluded from totals; §35 vendor payables, RCM excluded
// ---------------------------------------------------------------------------
section('§8, §34-35 — Statistical exclusion & vendor payables (RCM excluded)');
{
  const po: DagPurchaseOrder = {
    vendorId: 'po-vendor',
    vendorName: 'Acme Components',
    deliveryState: 'Maharashtra',
    lines: [
      {
        id: 'L9',
        qty: 100,
        unitPrice: 1000,
        conditions: [
          cond({
            conditionCode: 'FREIGHT',
            category: 'LOGI',
            calcBasis: 'PCT_OF_LINE_BASE',
            rate: 10,
            sign: '+',
            vendorId: 'freight-vendor',
            vendorName: 'Blue Dart Logistics',
            vendorRule: 'MUST_DIFFER',
          }),
          cond({
            conditionCode: 'RCM_SERVICE',
            category: 'OTHR',
            calcBasis: 'FIXED_PER_LINE',
            rate: 2000,
            sign: '+',
            gstTreatment: 'RCM',
            gstRate: 18,
            vendorId: 'freight-vendor',
            vendorName: 'Blue Dart Logistics',
          }),
          cond({
            conditionCode: 'INTERNAL_ESTIMATE',
            category: 'OTHR',
            calcBasis: 'FIXED_PER_LINE',
            rate: 3000,
            sign: '+',
            statistical: true,
          }),
        ],
      },
    ],
    headerConditions: [],
  };

  const result = computePO(po, VENDORS);
  check('Statistical total excluded from PO total (still tracked)', result.statisticalTotal, 3000);
  check('Statistical condition excluded from taxable value', result.taxableValue, 100000 + 10000 + 2000);

  const freightVendor = result.vendorPayables.find((v) => v.vendorId === 'freight-vendor');
  // RCM_SERVICE's own amount (₹2,000) IS payable to the vendor; only its self-assessed
  // GST (₹360, tracked separately in rcmTotal) is excluded from the vendor payable.
  check('Freight vendor payable (10,000 freight + 2,000 RCM service, GST excluded)', freightVendor?.amount ?? 0, 12000);
  check('RCM GST tracked separately, excluded from vendor payable', result.rcmTotal, 360);
}

// ---------------------------------------------------------------------------
console.log(`\n${'-'.repeat(60)}`);
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
