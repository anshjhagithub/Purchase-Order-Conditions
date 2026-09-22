 # PO Condition Calculation Engine — Complete Reference

A implementation-agnostic specification of the pricing/costing engine behind
PO Conditions. Everything here is written so you can rebuild it three ways:

1. **In this repo** — it's already built: `src/engine/calc.ts` (live, wired into
   the UI) and `src/engine/dag/calcEngine.ts` (a clean standalone reference
   implementation with worked-example tests).
2. **In Excel** — §6 gives a row layout and exact formula patterns.
3. **In a plain HTML/JS page** — §7 gives a ~90-line, dependency-free reference
   implementation you can paste into a `<script>` tag.

It also documents **all 33 condition types** from your master list (10 at
Header level, 31 at Item level — 8 of those are configured at both levels,
hence 41 rows across the two tables in your list) with their formula, what
each one depends on, and where it sits in the cascade — shows exactly what
happens, mechanically, when you add a brand-new custom condition type that
doesn't exist anywhere in this document yet (§8) — and shows how **condition
bundles** (applying a named, pre-configured group of conditions in one action)
fit into the same engine with zero special-case logic (§9).

---

## 1. The one idea everything else follows from

A Purchase Order line (or the PO header) has a **base value**:

```
BASE = Quantity × Unit Price
```

Every condition (discount, surcharge, freight, duty, insurance, clearing fee,
...) is a rule that computes an amount either **from that base directly**, or
**from the base plus whatever other conditions have already been computed** —
and then adds or subtracts that amount from the running total.

There is **no fixed, hardcoded order** ("Discount always comes first, then
Freight, then Duty..."). Instead, every condition declares **what it depends
on** — `BASE` and/or the codes of other conditions — and the engine works out
the correct evaluation order itself, every time, from those declarations. This
is what makes it possible to add a brand-new condition type with zero changes
to any other condition's configuration or to the engine's code.

---

## 2. Condition record — the fields every condition type needs

Whether you store this in a database, a config sheet, or an Excel row, every
condition type needs these fields:

| Field | Meaning | Example |
|---|---|---|
| `Code` | Unique identifier | `RA00` |
| `Name` | Human label | `Discount % on Net` |
| `Level` | `HEADER` (whole PO, then distributed to lines) or `ITEM` (one line only) | `ITEM` |
| `Category` | Rollup bucket for reporting: `DISC`, `SURC`, `LOGI`, `STAT`, `DEDN`, `OTHR` | `DISC` |
| `CalcBasis` | Which formula to use — one of 8 (see §3.3) | `PCT_OF_SELECTED_BASE` |
| `Rate` | The number entered — a %, a flat amount, or a rate-per-unit, depending on `CalcBasis` | `5` (meaning 5%) |
| `Sign` | `+` (adds to the running total) or `−` (subtracts) | `−` |
| `CalculateOn` | `LINE_BASE` (just the raw base) or `SELECTED` (an explicit list of dependencies) | `SELECTED` |
| `DependsOn` | If `CalculateOn = SELECTED`: the list of codes (and/or the literal token `BASE`) this condition's base is the *sum* of | `BASE, RA01` |
| `Rounding` | `NORMAL` / `UP` / `DOWN` / `NONE` | `NORMAL` |
| `Statistical` | If true: still shown/calculated, but excluded from every total, landed cost, and vendor payable | `false` |
| `Capitalise` | If true: this amount is added into landed/inventory cost | `true` |
| `GstTreatment` | `DEDUCTIBLE` / `NON_DEDUCTIBLE` / `RCM` / `EXEMPT` / `NIL_RATED` | `NON_DEDUCTIBLE` |
| `GstRate` | % | `18` |
| `VendorRule` | `SAME_AS_PO` / `MUST_DIFFER` / `EITHER` | `MUST_DIFFER` |
| `DistributionBasis` | HEADER-level only: how to split across lines — `VALUE`/`QUANTITY`/`WEIGHT`/`VOLUME`/`EQUAL` | `VALUE` |

That's the entire schema. Nothing else is needed to add a new condition type —
see §8.

---

## 3. The universal calculation algorithm

This is the exact sequence the engine runs, once per line (for `ITEM`-level
conditions) and once per PO (for `HEADER`-level conditions, before they get
distributed back to lines). It is deliberately **not** sequence-number driven.

### 3.1 Build the dependency graph

For every condition, look at its `DependsOn` list. Draw an edge from the
condition to each code it depends on (ignore the literal `BASE`, which isn't
a condition — it's the root value). This gives you a graph like:

```
BASE ─┬─► RA01 ─► RA00 ─┬─► ZA00 ─► ZDEP ─► ZATP ─► ZPFP ─► ZOCP ─► FRA1 ─► ZINP ─► ZLND ─► JCDB ─┬─► JSWS
      │                 │                                                                        │
      └─────────────────┴─(RB00, RC00, ZA01, ZB00, ZC00, ... all feed in wherever they're listed)─┴─► ZCHP
```

### 3.2 Detect problems, then sort

- **A condition cannot depend on itself.** (`DependsOn` lists its own code.)
- **No cycles allowed.** If A depends on B, B depends on C, and C depends on
  A, that's an error — reject it before computing anything, with a message
  like *"Circular dependency: A → B → C → A."*
- **A missing reference is an error, not a zero.** If a condition's
  `DependsOn` lists a code that isn't in this evaluation set at all, that's a
  configuration bug — surface it, don't silently treat it as ₹0.
- Once validated, do a **topological sort**: every condition is placed after
  everything it depends on. Conditions with no dependency relationship to
  each other can be evaluated in any relative order — use their (optional,
  purely cosmetic) sequence number or code as a tie-breaker so the output is
  stable and readable, but that number never overrides an actual dependency.

### 3.3 Compute each condition's raw amount, in that order

For each condition, in topological order, first resolve **its own base**:

```
if CalculateOn = LINE_BASE:
    base = BASE
else:  # SELECTED
    base = sum of: BASE (if listed) + the already-computed amount of every
           other code in DependsOn (guaranteed available — they were
           processed earlier, by construction of the sort)
```

Then apply the formula for its `CalcBasis`:

| CalcBasis | Formula | Used for |
|---|---|---|
| `FIXED_PER_PO` | `raw = Rate` (once, at header level) | Flat header charges |
| `FIXED_PER_LINE` | `raw = Rate` (quantity does **not** multiply it) | Flat per-line charges |
| `RATE_X_QTY` | `raw = Rate × Qty` | Per-unit charges |
| `RATE_X_WEIGHT` | `raw = Rate × (Qty × UnitWeight)` | Freight/duty by weight |
| `RATE_X_VOLUME` | `raw = Rate × (Qty × UnitVolume)` | Freight by volume/CBM |
| `PCT_OF_LINE_BASE` | `raw = Rate/100 × BASE` | % that ignores everything else |
| `PCT_OF_SELECTED_BASE` | `raw = Rate/100 × base` (the resolved `base` above) | % "on Net", "on Gross", "on CIF", etc. — the entire cascading mechanism |
| `SLAB` | Look up a rate from a from/to table using a driver (qty, weight, volume, or the resolved base), then `raw = row.rate × driver` (flat per-unit) — **or**, if your slab table stores percentages instead of per-unit rates, `raw = row.rate/100 × driver` | Volume-tiered discounts/freight |

### 3.4 Sign, then rounding, then tax — always in that order

```
signed  = Sign === '−' ? −abs(raw) : abs(raw)
rounded = round(signed, Rounding)          # NORMAL / UP / DOWN / NONE
gst     = (GstTreatment in {EXEMPT, NIL_RATED}) ? 0
                                            : round(abs(rounded) × GstRate/100)
```

Store `rounded` keyed by this condition's `Code` — that's what later
conditions' `DependsOn` will read.

### 3.5 Header conditions: compute once, then distribute

A `HEADER`-level condition is computed exactly once, against the PO-wide base
(sum of every affected line's `BASE`), using the same §3.3–3.4 steps. Its
final rounded amount is then split across the lines it applies to:

```
weight(line) = VALUE    → line.qty × line.unitPrice
             = QUANTITY → line.qty
             = WEIGHT   → line.qty × line.unitWeight
             = VOLUME   → line.qty × line.unitVolume
             = EQUAL    → 1

line's share = header amount × weight(line) / sum(weight(all affected lines))
```//
(Zero total weight across every affected line is an error, not a silent 0.)

### 3.6 Roll up totals

```
Taxable Value   = BASE + Σ(rounded amounts), excluding Statistical conditions
GST Total       = Σ(gst), excluding RCM (self-assessed, not vendor-payable) and EXEMPT/NIL_RATED
PO Grand Total  = Taxable Value + GST Total
Landed Cost     = BASE + Σ(rounded amounts of every Capitalise = true condition)
Per-Unit Landed = Landed Cost / Qty
Vendor Payable  = grouped by each condition's own Vendor (freight vendor, insurance
                  vendor, customs authority, ... may all differ from the PO vendor);
                  RCM's GST portion is excluded (self-assessed); Statistical excluded entirely
```

That's the complete algorithm — 6 steps, no exceptions, no hardcoded ordering.
Everything in §4 below is just **data** that plugs into it.

---

## 4. Complete condition type catalogue (all 33 codes)

Legend: **Level** H = Header, I = Item, H+I = configured at both.
**Depends On** — `BASE` alone is equivalent to "on Gross"; a longer list
means "on whatever's been computed so far, up to and including these."

The order below is one sensible, fully-worked default cascade for an import
PO (Gross → Net → Surcharges → Freight → Insurance → CIF → Landing Charges →
Duty → Clearing → Landed Cost → post-GRN variance). **This ordering is not
hardcoded anywhere** — it falls out purely from each row's `Depends On`
column, per §3. Reconfigure any `Depends On` and the cascade reorders itself.

### A. Base

| Code | Name | Level | Category | CalcBasis | Depends On | Sign | Capitalise | Notes |
|---|---|---|---|---|---|---|---|---|
| `PB00` | Gross Price | I | OTHR | `RATE_X_QTY` (Rate = unit price) | — (this **is** `BASE`) | + | No | The root of the cascade. Everything else's `BASE` token means "this value." |
| `PBXX` | Gross Price (manual/alt) | I | OTHR | `FIXED_PER_LINE` | — | + | No | **Statistical.** A manually-entered reference price shown for comparison; never feeds into Net. |

### B. Net price build-up

| Code | Name | Level | Category | CalcBasis | Depends On | Sign | Capitalise |
|---|---|---|---|---|---|---|---|
| `RA01` | Discount % on Gross | H+I | DISC | `PCT_OF_SELECTED_BASE` | `BASE` | − | Yes |
| `RA00` | Discount % on Net | H+I | DISC | `PCT_OF_SELECTED_BASE` | `BASE, RA01` | − | Yes |
| `RB00` | Absolute discount | H+I | DISC | `FIXED_PER_LINE` (I) / `FIXED_PER_PO` (H) | — | − | Yes |
| `RC00` | Discount/Quantity | I | DISC | `RATE_X_QTY` | — | − | Yes |

`NET = BASE + RA01 + RA00 + RB00 + RC00`

### C. Surcharges & commercial add-ons (all cascade off Net)

| Code | Name | Level | Category | CalcBasis | Depends On | Sign | Capitalise |
|---|---|---|---|---|---|---|---|
| `ZA01` | Surcharge % on Gross | H+I | SURC | `PCT_OF_SELECTED_BASE` | `BASE` | + | Yes |
| `ZA00` | Surcharge % on Net | H+I | SURC | `PCT_OF_SELECTED_BASE` | `BASE, RA01, RA00, RB00, RC00, ZA01` | + | Yes |
| `ZB00` | Surcharge (Value) | H+I | SURC | `FIXED_PER_LINE` / `FIXED_PER_PO` | — | + | Yes |
| `ZC00` | Surcharge/Quantity | I | SURC | `RATE_X_QTY` | — | + | Yes |
| `ZDEP` | Development % | I | SURC | `PCT_OF_SELECTED_BASE` | `BASE ... ZC00` (everything in group C so far) | + | Yes |
| `ZDEV` | Development Value | I | SURC | `FIXED_PER_LINE` | — | + | Yes |
| `ZATP` | Amortization % | I | SURC | `PCT_OF_SELECTED_BASE` | `BASE ... ZDEV` | + | Yes |
| `ZATV` | Amortization Value | I | SURC | `FIXED_PER_LINE` | — | + | Yes |
| `ZPFP` | P&F Clearing % | I | LOGI | `PCT_OF_SELECTED_BASE` | `BASE ... ZATV` | + | Yes |
| `ZPFV` | P&F Clearing Value | I | LOGI | `FIXED_PER_LINE` | — | + | Yes |
| `ZOCP` | Other Chg Clearing % | I | OTHR | `PCT_OF_SELECTED_BASE` | `BASE ... ZPFV` | + | Yes |
| `ZOCV` | Other Chg Clr Value | I | OTHR | `FIXED_PER_LINE` | — | + | Yes |

`ADJUSTED NET = NET + Σ(group C)`

### D. Freight

| Code | Name | Level | Category | CalcBasis | Depends On | Sign | Capitalise |
|---|---|---|---|---|---|---|---|
| `FRA1` | Freight % | I | LOGI | `PCT_OF_SELECTED_BASE` | `BASE ... ADJUSTED NET` | + | Yes |
| `FRB1` | Freight (Value) | I | LOGI | `FIXED_PER_LINE` | — | + | Yes |
| `FRC1` | Freight/Quantity | I | LOGI | `RATE_X_QTY` (or `RATE_X_WEIGHT`/`RATE_X_VOLUME`) | — | + | Yes |
| `ZFR2` | Freight (Percentage) | H | LOGI | `PCT_OF_SELECTED_BASE` | `BASE ... ADJUSTED NET`, at PO scope | + | Yes |
| `ZFR1` | Freight (Value) | H | LOGI | `FIXED_PER_PO` | — | + | Yes |

`+ FREIGHT = ADJUSTED NET + Σ(group D)`. `ZFR1`/`ZFR2` are computed once at PO
level and distributed to lines per `DistributionBasis` (§3.5) — typically
`WEIGHT` or `VOLUME` for ocean/air freight, `VALUE` otherwise.

### E. Insurance

| Code | Name | Level | Category | CalcBasis | Depends On | Sign | Capitalise |
|---|---|---|---|---|---|---|---|
| `ZINP` | Insurance Clearing % | I | LOGI | `PCT_OF_SELECTED_BASE` | `BASE ... + FREIGHT` | + | Yes |
| `ZINV` | Insurance Clg Value | I | LOGI | `FIXED_PER_LINE` | — | + | Yes |

`CIF VALUE = (+ FREIGHT) + Σ(group E)` — Cost + Insurance + Freight, the
standard customs-valuation starting point.

### F. Landing charges

| Code | Name | Level | Category | CalcBasis | Depends On | Sign | Capitalise |
|---|---|---|---|---|---|---|---|
| `ZLND` | Landing charges % | H+I | LOGI | `PCT_OF_SELECTED_BASE` | `BASE ... CIF VALUE` | + | Yes |
| `ZLNV` | Landing charges Value | H+I | LOGI | `FIXED_PER_LINE` / `FIXED_PER_PO` | — | + | Yes |

`ASSESSABLE VALUE (AV) = CIF VALUE + Σ(group F)` — in Indian customs practice
this is a flat 1% of CIF, added *before* duty is computed.

### G. Customs duty

| Code | Name | Level | Category | CalcBasis | Depends On | Sign | Capitalise |
|---|---|---|---|---|---|---|---|
| `JCDB` | IN Basic Customs Duty | I | STAT | `PCT_OF_SELECTED_BASE` | `BASE ... AV` | + | Yes |
| `JSWS` | IN: Import SWS | I | STAT | `PCT_OF_SELECTED_BASE` | `JCDB` **only** | + | Yes |
| `JADD` | Antidumping Duty | I | STAT | `RATE_X_QTY` (specific duty — per unit; use `PCT_OF_SELECTED_BASE` on `BASE...AV` instead if your tariff schedule is ad valorem) | — (or `BASE...AV`) | + | Yes |

`DUTY-PAID VALUE = AV + JCDB + JSWS + JADD`. `JSWS` is the textbook "tax on a
tax" — 10% of `JCDB` alone, nothing else — which is exactly why the engine
needs per-condition dependency declarations rather than one global % base.

### H. Clearing & handling

| Code | Name | Level | Category | CalcBasis | Depends On | Sign | Capitalise |
|---|---|---|---|---|---|---|---|
| `ZCHP` | CHA Clearing % | I | LOGI | `PCT_OF_SELECTED_BASE` | `BASE ... DUTY-PAID VALUE` | + | Yes |
| `ZCHV` | CHA Clearing Value | I | LOGI | `FIXED_PER_LINE` | — | + | Yes |

`LANDED COST = DUTY-PAID VALUE + Σ(group H)`

### I. Post-GRN / post-invoice reconciliation

| Code | Name | Level | Category | CalcBasis | Depends On | Sign | Capitalise |
|---|---|---|---|---|---|---|---|
| `ZPDV` | Price Variance | I | OTHR | `FIXED_PER_LINE` (manual entry = `(Invoice Price − PO Price) × Qty`) | — | **+ or −**, whichever the variance is | No — **Statistical**, posted to a variance/reconciliation account, not into Landed Cost |

---

## 5. Full worked example

Line: **Qty = 100**, **Gross Unit Price = ₹1,000** → `PB00 = BASE = ₹1,00,000`

```
Group B — Net build-up
  RA01  Disc % on Gross    2%  of BASE (100,000)              = −2,000
  RA00  Disc % on Net      1%  of (BASE+RA01 = 98,000)         =   −980
  RB00  Absolute discount  flat                                =   −500
  RC00  Disc/Quantity      ₹1 × 100                            =   −100
  ────────────────────────────────────────────────────────────────────
  NET = 100,000 − 2,000 − 980 − 500 − 100                      = 96,420

Group C — Surcharges (showing one of each pattern; ZDEP/ZDEV/ZATP/ZATV/
  ZPFP/ZPFV/ZOCP/ZOCV follow the identical %/Value formulas, omitted here
  and left at ₹0 for readability)
  ZA01  Surcharge % on Gross  0.5% of BASE (100,000)           =   +500
  ZB00  Surcharge (Value)     flat                             =   +300
  ZC00  Surcharge/Quantity    ₹2 × 100                         =   +200
  ────────────────────────────────────────────────────────────────────
  ADJUSTED NET = 96,420 + 500 + 300 + 200                      = 97,420

Group D — Freight
  FRA1  Freight %       5%  of ADJUSTED NET (97,420)           = +4,871
  FRB1  Freight (Value) flat                                   = +1,200
  ────────────────────────────────────────────────────────────────────
  + FREIGHT = 97,420 + 4,871 + 1,200                           = 103,491

Group E — Insurance
  ZINP  Insurance % on CIF-so-far   1.5% of 103,491             = +1,552
  ────────────────────────────────────────────────────────────────────
  CIF VALUE = 103,491 + 1,552                                  = 105,043

Group F — Landing charges
  ZLND  Landing charges %   1% of CIF VALUE (105,043)           = +1,050
  ────────────────────────────────────────────────────────────────────
  ASSESSABLE VALUE (AV) = 105,043 + 1,050                       = 106,093

Group G — Customs duty
  JCDB  Basic Customs Duty  10% of AV (106,093)                 = +10,609
  JSWS  Import SWS          10% of JCDB (10,609) ONLY            =  +1,061
  JADD  Antidumping Duty    ₹15/unit × 100                       =  +1,500
  ────────────────────────────────────────────────────────────────────
  DUTY-PAID VALUE = 106,093 + 10,609 + 1,061 + 1,500             = 119,263

Group H — Clearing
  ZCHP  CHA Clearing %  0.5% of Duty-Paid Value (119,263)        =   +596
  ────────────────────────────────────────────────────────────────────
  LANDED COST = 119,263 + 596                                    = 119,859

Group I — Reconciliation (standalone, does not feed Landed Cost)
  ZPDV  Price Variance — invoice came in ₹500 over the PO net    →  +500
        (posted to a variance account, shown for audit only)
```

Every number above traces to exactly one row's formula in §4 — nothing is
hand-waved. This is the shape any UI, Excel sheet, or API response should be
able to reproduce and display as a running cascade (see the existing
`ConditionCalcModal` / cascade table in this repo for a live UI rendering of
exactly this).

---

## 6. Building this in Excel

Lay out one row per condition **instance** (not per type — if a PO has both
`RA01` and `RA00`, that's two rows), pre-sorted in dependency order (which is
just doing the topological sort in §3.2 by hand once — for a fixed cascade
like the one in §4/§5 you only do this once, then reuse the sheet).

| Column | Header | Contents |
|---|---|---|
| A | Step | 10, 20, 30... (display only, not used in formulas) |
| B | Code | `RA01` |
| C | Name | `Discount % on Gross` |
| D | CalcBasis | `PCT` / `FIXED` / `RATE_QTY` |
| E | Rate | `2` |
| F | Sign | `+` or `−` |
| G | DependsOn | `BASE` or `BASE,RA01` (comma list, no spaces) |
| H | BaseAmount | *(formula below)* |
| I | RawAmount | *(formula below)* |
| J | RoundedAmount | *(formula below)* |
| K | RunningTotal | *(formula below)* |

Seed cell `LineBase` (named cell, e.g. `$K$1`) with `=Qty * UnitPrice`.

**BaseAmount** (H2, fill down) — sums `LineBase` (if `BASE` is in this row's
`DependsOn`) plus the already-computed `RoundedAmount` of every other code
listed:

```
=IF(ISNUMBER(SEARCH("BASE",G2)), LineBase, 0)
 + SUMPRODUCT(ISNUMBER(SEARCH(","&$B$2:$B$50&",", ","&SUBSTITUTE(G2," ","")&",")) * $J$2:$J$50)
```

**RawAmount** (I2):

```
=IF(D2="FIXED", E2,
  IF(D2="RATE_QTY", E2*Qty,
    IF(D2="PCT", E2/100*H2, 0)))
```

**RoundedAmount** (J2) — applies sign then rounding:

```
=ROUND(IF(F2="-", -ABS(I2), ABS(I2)), 0)
```
(swap `ROUND(...,0)` for `CEILING(...,1)` / `FLOOR(...,1)` per row if that
condition's rounding rule is UP/DOWN instead of NORMAL.)

**RunningTotal** (K2): `=K1 + J2`, with `K1` seeded to `LineBase`.

This reproduces §3 exactly: because `BaseAmount` looks up prior rows by
*code*, not by row position, you can insert a brand-new condition anywhere in
the sheet (see §8) as long as its `DependsOn` only references rows that sit
**above** it — which is the same topological-order requirement the real
engine enforces automatically. (If you get it wrong and create a genuine
circular reference, Excel will tell you with its own circular-reference
warning — a nice, free parallel to §3.2's cycle check.)

---

## 7. Building this in plain HTML/JS

A complete, dependency-free reference implementation (~90 lines) — paste into
a `<script>` tag:

```js
function computeCascade(conditions, ctx) {
  // conditions: [{ code, calcBasis, rate, sign, dependsOn: ['BASE', ...], rounding }]
  // ctx: { base, qty, unitWeight, unitVolume }
  const byCode = Object.fromEntries(conditions.map(c => [c.code, c]));

  // 1. Build graph + detect cycles/missing refs
  const graph = {};
  for (const c of conditions) {
    graph[c.code] = (c.dependsOn || []).filter(d => d !== 'BASE');
    for (const dep of graph[c.code]) {
      if (dep === c.code) throw new Error(`${c.code} cannot depend on itself`);
      if (!byCode[dep]) throw new Error(`${c.code} references missing "${dep}"`);
    }
  }
  const state = {}; // 0=unvisited 1=in-progress 2=done
  const order = [];
  const visit = (code, path) => {
    if (state[code] === 2) return;
    if (state[code] === 1) throw new Error(`Circular dependency: ${[...path, code].join(' -> ')}`);
    state[code] = 1;
    for (const dep of graph[code]) visit(dep, [...path, code]);
    state[code] = 2;
    order.push(byCode[code]);
  };
  for (const c of conditions) visit(c.code, []);

  // 2. Evaluate in dependency order
  const amounts = {};
  const results = [];
  for (const c of order) {
    const base = (c.dependsOn || ['BASE']).reduce(
      (sum, dep) => sum + (dep === 'BASE' ? ctx.base : (amounts[dep] || 0)),
      0
    );
    let raw;
    switch (c.calcBasis) {
      case 'FIXED': raw = c.rate; break;
      case 'RATE_QTY': raw = c.rate * ctx.qty; break;
      case 'RATE_WEIGHT': raw = c.rate * ctx.qty * ctx.unitWeight; break;
      case 'RATE_VOLUME': raw = c.rate * ctx.qty * ctx.unitVolume; break;
      case 'PCT': raw = (c.rate / 100) * base; break;
      default: throw new Error(`Unknown calcBasis "${c.calcBasis}"`);
    }
    const signed = c.sign === '-' ? -Math.abs(raw) : Math.abs(raw);
    const round = { NORMAL: Math.round, UP: Math.ceil, DOWN: Math.floor, NONE: (x) => x }[c.rounding || 'NORMAL'];
    const roundedAbs = round(Math.abs(signed));
    const rounded = signed < 0 ? -roundedAbs : roundedAbs;
    amounts[c.code] = rounded;
    results.push({ code: c.code, base, raw, rounded });
  }
  return results;
}

// Example — reproduces the first four rows of §5:
const out = computeCascade(
  [
    { code: 'RA01', calcBasis: 'PCT', rate: 2, sign: '-', dependsOn: ['BASE'] },
    { code: 'RA00', calcBasis: 'PCT', rate: 1, sign: '-', dependsOn: ['BASE', 'RA01'] },
    { code: 'RB00', calcBasis: 'FIXED', rate: 500, sign: '-', dependsOn: [] },
    { code: 'RC00', calcBasis: 'RATE_QTY', rate: 1, sign: '-', dependsOn: [] },
  ],
  { base: 100000, qty: 100, unitWeight: 0, unitVolume: 0 }
);
console.table(out);
// -> RA01: -2000, RA00: -980, RB00: -500, RC00: -100  (matches §5 exactly)
```

This is a trimmed version of the same algorithm as
`src/engine/dag/calcEngine.ts` in this repo (which additionally handles
header distribution, GST/jurisdiction, landed cost, and vendor payables — see
that file for the full production version, with 32 runnable worked-example
assertions in `src/engine/dag/examples.ts`).

---

## 8. Adding a brand-new custom condition type

This is the entire point of a dependency-driven engine: **a new condition
type never requires touching any other condition's configuration, or any
engine code.** You only ever fill in one new row of the schema from §2.

### Checklist for a new condition

1. **Code** and **Name** — anything unique, e.g. `ZENV` / "Environmental Cess".
2. **Level** — Header or Item?
3. **Category** — which rollup bucket for reporting.
4. **CalcBasis** — pick one of the 8 formulas in §3.3. Nothing new to build —
   every possible condition shape (flat, per-unit, %-of-something, slab) is
   already one of these 8.
5. **Rate**, **Sign**, **Rounding**.
6. **CalculateOn / DependsOn** — the only field that decides *where in the
   cascade* this condition lands. List `BASE` and/or whichever existing
   condition codes it should be computed on top of.
7. **Capitalise?**, **Statistical?**, **GST treatment**, **Vendor Rule** as
   needed.

### Worked example — adding `ZENV` (Environmental Cess, 2%)

Say the business now needs a 2% Environmental Cess, charged on the same
Duty-Paid Value as CHA Clearing (`ZCHP`) in §4/§5, and — because it's a
statutory levy, not a service fee — CHA Clearing should from now on be
charged *after* it (on Duty-Paid Value **including** the cess), not before.

**Step 1 — define the row:**

| Field | Value |
|---|---|
| Code | `ZENV` |
| Name | Environmental Cess |
| Level | Item |
| Category | STAT |
| CalcBasis | `PCT_OF_SELECTED_BASE` |
| Rate | 2 |
| Sign | + |
| DependsOn | `BASE ... DUTY-PAID VALUE` (i.e. `BASE, RA01, RA00, RB00, RC00, ZA01, FRA1, FRB1, ZINP, ZLND, JCDB, JSWS, JADD` — the same list `ZCHP` already used) |
| Capitalise | Yes |

**Step 2 — one edit to an existing row:** since CHA Clearing should now apply
*after* the cess, add `ZENV` to `ZCHP`'s `DependsOn` list. That's it — no
other condition's configuration changes, and nothing in the algorithm (§3)
changes.

**Step 3 — the engine (or your Excel sheet, or the JS snippet in §7) just
re-sorts.** `ZENV`'s dependencies (everything up to Duty-Paid Value) are
already computed by the time it's reached; `ZCHP` now depends on one more
code (`ZENV`) so it simply moves to right after it in the topological order.

**Recomputed cascade from §5** (only the tail end changes):

```
DUTY-PAID VALUE (unchanged)                                    = 119,263
ZENV  Environmental Cess  2% of Duty-Paid Value (119,263)       = +2,385
ZCHP  CHA Clearing %      0.5% of (119,263 + 2,385 = 121,648)    =   +608   (was 596)
──────────────────────────────────────────────────────────────────────────
LANDED COST = 119,263 + 2,385 + 608                              = 122,256   (was 119,859)
```

Nothing about `PB00` through `JADD` needed to be touched, re-derived, or
re-tested — the dependency graph absorbed the new node and re-sorted itself.
This is the concrete proof of §1's claim, and it's exactly what
`buildConditionDependencyGraph` / `topologicalSortConditions` in
`src/engine/dag/calcEngine.ts` do at runtime every time a condition is added
via the "Add Custom PO Condition" UI in this app.

### What if the new condition doesn't fit any of the 8 `CalcBasis` formulas?

It will — the 8 cover every shape of "how do you turn a rate into an amount"
that exists in this catalogue (flat, per-unit-of-qty/weight/volume, % of a
value, slab-lookup). If you find a genuinely new *shape* of formula, that's
the one place that requires an engine code change (a 9th case in the §3.3
switch) — everything else (a new percentage-based fee, a new flat charge, a
new per-unit levy, wherever it sits in the cascade) is pure configuration.

---

## 9. Condition bundles — applying a named group of conditions in one action

A **condition bundle** is not a new calculation concept — it's a UX/data-entry
convenience layered on top of everything in §1–§8. A bundle is just a named,
curated list of condition **codes** (e.g. "Import Shipment — Sea" →
`OCEAN-FRT, MARINE-INS, BCD, SWS, IMPORT-IGST, CHA-FEE`). Applying it inserts
every one of those conditions in a single action instead of adding them
one-by-one through the "Add Custom PO Condition" flow.

```ts
interface ConditionBundle {
  id: string;
  name: string;
  description: string;
  conditionCodes: string[];   // Condition Master codes, in no particular order
}
```

### 9.1 How calculation works for a bundle — the short answer

**Exactly the same as §3, with zero special-casing.** Each condition in a
bundle already carries its own `CalcBasis`, `Sign`, `Rate`, and — critically —
its own `DependsOn` (`calculateOnCodes`) from its Condition Master record,
just like any condition added individually. A bundle does not define its own
ordering, its own combined formula, or any cross-condition logic of its own.
It is purely a batch-insert of pre-configured rows.

So when a bundle is applied to a line:

1. All of its conditions are added to that line's (or the PO header's)
   condition list in one step, alongside whatever conditions already existed
   there.
2. The engine then runs the **same** §3 algorithm over the **combined** set —
   pre-existing conditions plus the newly-added bundle conditions — exactly as
   it would after any single "Add Condition" action: build the dependency
   graph (§3.1), validate for cycles/missing refs (§3.2), topologically sort,
   then compute each condition's raw amount, sign, rounding, and GST in that
   order (§3.3–3.4).
3. Because the sort is by **code**, not by insertion order, it doesn't matter
   that six conditions arrived in the same instant instead of six separate
   clicks — `IMPORT-IGST`'s `DependsOn` can reference `BCD` and `SWS` from the
   *same* bundle, and the topological sort places `BCD` and `SWS` before it
   automatically, the same way `JSWS` depends only on `JCDB` in §4/§5.
4. `HEADER`-level conditions inside a bundle follow §3.5 exactly like any
   other header condition: computed once at PO scope, then distributed across
   whichever lines the bundle was applied to, per that condition's own
   `DistributionBasis`.

In other words: **a bundle changes nothing about how amounts are computed —
it only changes how many condition rows appear at once.** The proof is the
same one from §8: because ordering is dependency-derived, not
insertion-order-derived, adding N conditions at once is indistinguishable,
calculation-wise, from adding them N times in a row.

### 9.2 Worked example — applying "Import Shipment — Sea"

Bundle conditions (illustrative codes/rates — Level/CalcBasis/DependsOn all
come from each code's own Condition Master row, exactly as in §4):

| Code | Name | CalcBasis | DependsOn |
|---|---|---|---|
| `OCEAN-FRT` | Ocean Freight % | `PCT_OF_SELECTED_BASE` | `BASE` |
| `MARINE-INS` | Marine Insurance % | `PCT_OF_SELECTED_BASE` | `BASE, OCEAN-FRT` |
| `BCD` | Basic Customs Duty % | `PCT_OF_SELECTED_BASE` | `BASE, OCEAN-FRT, MARINE-INS` |
| `SWS` | Import SWS % | `PCT_OF_SELECTED_BASE` | `BCD` only |
| `IMPORT-IGST` | Import IGST % | `PCT_OF_SELECTED_BASE` | `BASE, OCEAN-FRT, MARINE-INS, BCD, SWS` |
| `CHA-FEE` | CHA Clearing Fee | `FIXED_PER_LINE` | — |

Applying this bundle to a line with `BASE = ₹1,00,000` inserts all six rows in
one action. The engine's dependency graph now looks like:

```
BASE ─► OCEAN-FRT ─► MARINE-INS ─► BCD ─┬─► SWS ─► IMPORT-IGST
                                        └────────────────────► IMPORT-IGST
                                        └──────────────────────────────────► (CHA-FEE has no deps — computed independently)
```

The topological sort (§3.2) produces exactly one valid order —
`OCEAN-FRT, MARINE-INS, BCD, SWS, IMPORT-IGST` (with `CHA-FEE` slotted in
wherever its sequence/code tie-breaker places it, since it depends on
nothing) — **regardless of the order `conditionCodes` happened to list them
in on the bundle definition.** Reordering `bundle.conditionCodes` to
`['CHA-FEE', 'IMPORT-IGST', 'BCD', ...]` produces an identical result, because
§3's sort never trusts array position — only declared dependencies.

If the line already had `RA01`/`RA00` (Group B discounts, §4) applied before
the bundle, the combined graph simply grows: `OCEAN-FRT`'s `BASE` still
resolves the same way, and any bundle condition whose `DependsOn` was written
as `BASE, RA01, RA00, ...` (i.e. configured to cascade off Net rather than
Gross) picks those up too — again, no bundle-specific logic, just more nodes
in the same graph.

### 9.3 Validation rules that still apply, unchanged

Every rule in §10 (validation) and §3.2 applies identically to bundle-inserted
conditions: a bundle condition cannot depend on itself or on a code missing
from the resulting set (including other bundle members), a cycle across
bundle + existing conditions is still a hard error, mutually-exclusive
condition clashes (P8, `AddConditionModal.tsx`) are still checked against
every target line before the bundle is applied, and header-level bundle
conditions still require a non-zero distribution weight across every line the
bundle was applied to (§3.5, §10 rule 9).

### 9.4 Where this lives in this repository

| Concept | File |
|---|---|
| `ConditionBundle` type (`id`, `name`, `description`, `conditionCodes`) | `src/types/index.ts` |
| Seed bundle data (e.g. `bundle-import-sea`, `bundle-domestic-std`) | `src/data/seed.ts` (`CONDITION_BUNDLES`) |
| Apply a bundle to one line from the Line Items tab (single target line) | `src/pages/PO/BundleAndCopy.tsx` |
| Apply a bundle from the "Add Condition" modal — lets you pick This line / Selected lines / All lines as the target scope, and shows a live cascade preview of the whole bundle before saving | `src/pages/PO/AddConditionModal.tsx` (Mode toggle → "Condition Bundle") |

Both entry points build one `AppliedCondition` per bundle member (copying
that code's `CalcBasis`/`DependsOn`/etc. straight off its Condition Master
row) and push them all into the PO in a single update — they never introduce
a bundle-specific field on `AppliedCondition` itself, and `computeLine`/
`computePO` in `src/engine/calc.ts` have no knowledge that a "bundle" concept
exists at all. That absence is the point: it's the same proof as §8, applied
to N conditions at once instead of one.

---

## 10. Validation rules to replicate, wherever you build this

1. A condition cannot depend on itself.
2. A dependency cycle is a hard error, caught before any amount is computed.
3. A missing dependency reference is a hard error — never silently treated
   as ₹0.
4. Sign is applied, then rounding, then GST — always in that order.
5. `FIXED_PER_LINE`/`FIXED_PER_PO` amounts are never multiplied by quantity.
6. Statistical conditions are still computed and displayed, but excluded from
   every total, landed cost figure, and vendor payable.
7. RCM GST is computed (for audit visibility) but excluded from vendor
   payable — it's self-assessed by the buyer, not paid to the vendor.
8. Header-level condition amounts are computed once at PO scope, *then*
   distributed to lines — never the other way around.
9. A zero total distribution weight (e.g. every affected line has 0 volume,
   but distribution basis is VOLUME) is an error, not a silent 0-for-everyone.
10. Recalculating after any upstream input changes (qty, rate, a new
    condition) must re-derive every downstream dependency fresh — never reuse
    a stale cached amount.

---

## Appendix — where this lives in this repository

| Concept | File |
|---|---|
| Live engine wired into the app's UI (sequence field kept for display/tie-breaking only; order is dependency-derived — see `orderByDependency`) | `src/engine/calc.ts` |
| Clean standalone reference implementation (no sequence field at all) | `src/engine/dag/calcEngine.ts`, `src/engine/dag/types.ts` |
| Runnable worked-example assertions (32 checks, `npm run calc:examples`) | `src/engine/dag/examples.ts` |
| Field-by-field explanation of every option in the "Add Custom PO Condition" form | `src/pages/ConditionMaster/README.md` |
| Where conditions get applied to a real PO and the cascade preview renders | `src/pages/PO/AddConditionModal.tsx`, `src/pages/PO/PoSummaryBlock.tsx` |
| Condition bundles — type, seed data, and both places a bundle can be applied from (§9) | `src/types/index.ts` (`ConditionBundle`), `src/data/seed.ts` (`CONDITION_BUNDLES`), `src/pages/PO/BundleAndCopy.tsx`, `src/pages/PO/AddConditionModal.tsx` |
