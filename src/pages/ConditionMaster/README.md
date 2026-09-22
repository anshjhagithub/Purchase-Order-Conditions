# Add Custom PO Condition — Field Reference

This document explains every option in the **"Add Custom PO Condition"** modal
(`ConditionMasterForm.tsx`), why it exists, and how it depends on — or drives —
other fields, calculations, and downstream screens (`AddConditionModal.tsx`,
`ConditionCalcModal.tsx`, `engine/calc.ts`, `GRNTab.tsx`, `InvoiceTab.tsx`).

A condition created here is a reusable **template** (`ConditionMaster`). It only
becomes a live cost line on a PO when someone applies it via
**"Add Conditions to Line Item"** (`AddConditionModal.tsx`), which snapshots the
template into an `AppliedCondition`. That instance is what the calculation
engine (`engine/calc.ts`) actually computes, and what `GRNTab.tsx` /
`InvoiceTab.tsx` react to.

---

## Section 1 — Identity

### Category *(master switch)*
`DISC` Discount · `SURC` Surcharge · `LOGI` Logistics/Delivery Cost ·
`STAT` Statutory Levy/Duty · `DEDN` Deduction/Retention · `OTHR` Other/Pass-through.

**Why it exists:** every other calculation/tax/vendor field has a "correct"
default for a given cost type (e.g. freight is always a vendor-vendor charge,
a discount is always a deduction). Rather than let users misconfigure those,
picking a Category applies a **preset** that fills in `sign`, `calcBasis`,
`codeType`, `vendorRule`, `capitalise`, `requiresServiceConfirmation`,
`rateEditableOnPo`, `allowedLevel`, and `calculateOn`/`calculationMode`.

**Dependencies:**
- Locked forever once the condition has been used on any PO (`usedOnAnyPo`) —
  changing category after real POs reference it would silently rewrite history.
- For every category except `OTHR`, **Sign** is locked to the preset value (a
  "Flip" button only appears for `OTHR`).
- Filters the **Sub-category** list to only that category's options.

| Category | Sign | Calc Basis | Code Type | Vendor Rule | Capitalise | Needs Confirmation | Rate editable on PO | Allowed Level | Seq band |
|---|---|---|---|---|---|---|---|---|---|
| DISC | − | % of line base | HSN | Same as PO | Yes | No | Yes | Both | 10–19 |
| SURC | + | Fixed per line | HSN | Same as PO | Yes | No | Yes | Both | 20–29 |
| LOGI | + | Rate × weight | SAC | Must differ | Yes | Yes | Yes | Header | 30–49 |
| STAT | + | % of selected base | HSN | Must differ | Yes | No | No | Header | 50–79 |
| DEDN | − | % of line base | HSN | Same as PO | No | No | Yes | Line | 90–99 |
| OTHR | + (editable) | Fixed per PO | SAC | Either | No | No | Yes | Both | 80–89 |

### Sub-category
A curated list per Category (e.g. under `LOGI`: Ocean Freight, Air Freight,
Last-Mile Delivery, Demurrage & Detention, Customs Clearance/CHA Fee, …).

**Why it exists:** pure reporting/analytics granularity — lets finance roll up
spend by a finer bucket than the 6 categories.
**Dependency:** options depend entirely on the chosen Category; no calculation
impact.

### Print on PO PDF
Boolean toggle — whether this condition line appears on the printed/PDF PO.
**Dependency:** none; display-only.

---

## Section 2 — Calculation

### Calculation Basis *(the formula)*
| Value | Meaning | Rate field label |
|---|---|---|
| `FIXED_PER_PO` | One flat amount for the whole PO | Amount |
| `FIXED_PER_LINE` | One flat amount per line | Amount |
| `RATE_X_QTY` | Rate × line quantity | Rate per unit |
| `PCT_OF_LINE_BASE` | % of that line's base value (qty × unit price) | Percentage |
| `PCT_OF_SELECTED_BASE` | % of a chosen base (see Calculate On) | Percentage |
| `RATE_X_WEIGHT` | Rate × (qty × unit weight) | Rate per KG/MT |
| `RATE_X_VOLUME` | Rate × (qty × unit volume) | Rate per CBM |
| `SLAB` | Rate looked up from a slab/scale table | Slab grid |

**Why it exists:** different cost types are naturally driven by different
quantities — freight by weight, a discount by value, a flat handling charge by
neither. This field tells the engine which formula in
`computeConditionAmount()` to run.

**Dependencies (what this field controls):**
- **UoM field** appears only for `RATE_X_QTY` / `RATE_X_WEIGHT` / `RATE_X_VOLUME`,
  and its options are filtered to the matching dimension (weight-basis only
  offers KG/MT, volume-basis only offers CBM, etc.) — a unit mismatch would
  make the rate meaningless.
- **Default Rate** is disabled when Basis = `SLAB`, because a single rate is
  meaningless once a slab table exists.
- **Slab Table** editor (rows of `from`/`to`/`rate`) plus **Index reference /
  Revision frequency / Revision lag** appear only when Basis = `SLAB` — these
  let a slab-based rate track an external index (e.g. diesel price) and
  auto-revise on a schedule. *(Not yet consumed by the live calc engine — see
  "Configured but not enforced" below.)*
- At PO-apply time, Basis becomes **read-only** — it also decides whether
  Quantity is locked to `1` (for the two `FIXED_*` bases) and which "Rate"
  label is shown in the cascade preview.
- In the engine, this is the literal switch statement that computes the raw
  amount before sign/rounding/tax are applied.
- In `GRNTab.tsx`, Basis decides whether a condition is "quantity-linked"
  (`RATE_X_QTY`/`WEIGHT`/`VOLUME`) — only those get a live variance
  recalculation banner when GRN quantities differ from plan.

### UoM (Unit of Measure)
Shown only for weight/volume/qty-driven bases (see above). Dimension must
match the basis (`COUNT`→Nos, `WEIGHT`→KG/MT, `VOLUME`→CBM).

### Default Rate
The rate/percentage/amount used unless overridden per-PO. Disabled when
Basis = `SLAB`. Whether it can even be edited *on the PO itself* is governed
by the separate **Rate editable on PO** flag (Section 5).

### Sign (+/−)
Whether the computed amount adds to or subtracts from the PO value.
**Dependency:** locked by Category preset for every category except `OTHR`
(only `OTHR` shows a manual "Flip" control). Drives display color
(red = deduction) and the actual arithmetic sign applied after the raw amount
is computed.

### Currency
INR / USD / EUR. Display-only (formatting); does not affect calculation logic.

### Rounding Rule
`NORMAL` (nearest unit) / `UP` / `DOWN` / `NONE` (keep decimals).
**Dependency:** applied as the last step of `computeConditionAmount()`, after
the raw formula and sign, before tax is calculated on the rounded amount.

### Statistical
Toggle — if on, the condition still displays on the PO but is **excluded**
from the PO total, vendor payable, and invoice claims.
**Why it exists:** lets you record informational-only figures (e.g. an
internal cost estimate) without them ever being paid out.
**Dependency:** enforced in `computePO()` (skipped from totals) and in
`InvoiceTab.tsx` (statistical conditions never generate a payable/invoice
claim for their vendor).

---

## Section 3 — Tax

### Code Type: HSN (Goods) / SAC (Services)
**Why it exists:** Indian GST classifies goods vs. services differently and
uses different code lists.
**Dependency:** filters the **Tax Code** dropdown to only HSN or only SAC
entries; changes the dynamic field label ("HSN Code" vs "SAC Code").

### Tax Code (HSN/SAC)
Picks a specific code (e.g. `996521` — Sea freight, 5% GST). Required unless
GST Treatment is `EXEMPT` or `NIL_RATED`.
**Dependency:** the chosen code determines the derived, read-only **GST Rate**
(overridable only with a mandatory audited reason).

### GST Treatment
`DEDUCTIBLE` / `NON_DEDUCTIBLE` / `RCM` (reverse charge) / `EXEMPT` / `NIL_RATED`.
**Why it exists:** determines how (and whether) GST is charged, claimed back,
or self-assessed.
**Dependencies:**
- `DEDUCTIBLE` reveals the **ITC Eligibility %** field (input tax credit the
  buyer can reclaim).
- `EXEMPT` / `NIL_RATED` force GST amount to zero and jurisdiction to "None" —
  Tax Code stops being mandatory.
- `RCM` marks the tax as self-assessed rather than payable to the vendor —
  shown as an amber "RCM — not payable to vendor" badge on the PO and
  excluded from the vendor's payable total on the calc breakdown.

### ITC Eligibility %
Only shown when GST Treatment = `DEDUCTIBLE`. Informational (input-tax-credit
tracking); not yet consumed by the calculation engine.

### Tax calculated on
`CONDITION_AMOUNT` vs `CONDITION_PLUS_SELECTED` — intended to control whether
GST is computed on this condition's amount alone or combined with other
selected steps. *(Defined on the template but not currently read by the
engine — always taxes the condition's own amount today.)*

### TDS Applicable
Toggle. When on, reveals a free-text **TDS Section** field (e.g. `194Q`).
Informational withholding-tax metadata; not consumed by the calc engine.

---

## Section 4 — Vendor & Ownership

### Vendor Rule
`SAME_AS_PO` / `MUST_DIFFER` / `EITHER`.
**Why it exists:** some conditions must be paid to the same vendor as the PO
(a discount only makes sense against the PO vendor); others (freight,
insurance, customs) are almost always a *different* vendor.
**Dependencies:**
- Locked (disabled) for `DISC`/`DEDN` categories, which are always `SAME_AS_PO`.
- Enforced at PO-apply time: `MUST_DIFFER` blocks saving if the chosen vendor
  equals the PO vendor; `SAME_AS_PO` blocks saving if it doesn't.
- Drives whether a new applied condition defaults its vendor to blank (so it
  falls back to the PO vendor) or requires an explicit pick.

### Default Vendor
Pre-fills the vendor field when this condition is applied to a PO.

### Vendor Group Filter
Restricts which vendors are selectable at PO-apply time to a chosen group
(e.g. "Logistics & Freight", "Insurance", "Statutory Authority").
**Why it exists:** prevents someone from accidentally routing a freight charge
to a raw-material vendor.

### Default Condition Invoice Owner / Default Condition GRN Owner
(Label becomes "Service Confirmation Owner" when **Requires Service
Confirmation** is on.) Free-text ownership metadata for internal
accountability; not enforced by any validation logic today.

---

## Section 5 — Advanced

### Calculate On *(no Sequence No.)*
There is no sequence number anywhere in this form or on `ConditionMaster` /
`AppliedCondition` — evaluation order is derived automatically from which
condition codes a condition's own rule *references* (`engine/calc.ts`
`dependenciesOf` / `orderByDependency`, a dependency graph + topological
sort). Saving a condition that would create a cycle (`A` needs `B`, `B` needs
`A`) is rejected with an explicit error (`detectCircularDependency`) — see
"Selected Conditions" and "Conditional Rule" below, the two modes that can
reference other conditions.

**Calculate On** is a single mode picker — one of:

| Mode | What it is | Rule shape |
|---|---|---|
| `BASE` | A formula against this line's base value only (% / fixed / rate×qty·weight·volume) | `{ mode: 'BASE', base: FormulaRule }` |
| `SELECTED_CONDITIONS` | A weighted sum of `BASE` and/or other conditions' **final calculated amount** (or, per-step, their calc base) — the old "Calculate On → Selected steps" cascade, now with a `+`/`-` operator per step | `{ mode: 'SELECTED_CONDITIONS', selected: { steps } }` |
| `DIRECT` | Same formula shape as `BASE` — a self-contained, non-cascading calculation | `{ mode: 'DIRECT', direct: FormulaRule }` |
| `CONDITIONAL` | An IF/AND/OR clause chain over PO/line attributes or another condition's amount, with a THEN and optional ELSE formula | `{ mode: 'CONDITIONAL', conditional }` |
| `SLAB` | Range-based tiers (quantity/weight/volume/base/PO amount), flat-per-unit or % | `{ mode: 'SLAB', slab }` |
| `CUMULATIVE` | Same tier matching as Slab, against a running total scoped to vendor/contract/material/etc. (history is mocked — no such backend exists yet) | `{ mode: 'CUMULATIVE', cumulative }` |

**Important distinction (Condition Base vs Condition Amount):** `SELECTED_CONDITIONS`
only builds this condition's **base** — Section 2's `Calculation Basis` + `Rate`
(shown only for this mode; every other mode is self-contained and hides them)
still decide how that base becomes the final **amount**, exactly like the
legacy "Calculate On → Selected steps" always worked. A step referencing
another condition defaults to that condition's `CONDITION_AMOUNT` (its final
computed value) — it can be switched to `CONDITION_BASE` per-step, but never
silently reads that condition's configured rate.

**Migrating existing data:** a `ConditionMaster` saved before this model
existed has no `calculationMode`/`calculationRule` — the engine (`getEffectiveRule`-
equivalent logic in `computeConditionAmount`) reads its legacy `calcBasis` /
`calculateOn` / `calculateOnCodes` fields and computes identically to before.
Opening such a record in this form pre-fills the new rule builder from that
same legacy data (`deriveRuleFromLegacy`) so editing it migrates it to the new
model on save — no separate migration step required.

### Include in Item Landed Cost (Capitalise)
Toggle. When on, this condition's amount is added into the PO's capitalised/
landed-cost total (relevant for inventory valuation of imported/logistics
costs).
**Dependency:** read by `computePO()`; surfaced as a "Capitalised" badge and
referenced in the GRN variance note ("capitalizes to landed cost").

### Allowed Level
`LINE` / `HEADER` / `BOTH` — where this condition can be applied: a single PO
line, the whole PO (header, then distributed across lines), or either.
**Why it exists:** some charges are inherently line-specific (a per-item
discount), others are inherently PO-wide (one freight invoice covering many
lines).
**Dependencies:**
- Determines which "Apply To" buttons (This line / Selected lines / All
  lines / Whole PO) are available in the PO-apply modal.
- `HEADER` or `BOTH` reveals the **Distribution Basis** field below, since a
  header-level amount must be split across lines somehow.

### Distribution Basis
`VALUE` / `QUANTITY` / `WEIGHT` / `VOLUME` / `EQUAL` — how a header-level
condition's total amount is apportioned across the PO's lines.
**Dependency:** only shown when Allowed Level is not `LINE`. Consumed by
`distributeAcrossLines()`, which weights each line by its share of value,
quantity, weight, volume, or an equal split.

### Requires Service Confirmation
Toggle — marks this condition as needing a GRN-side confirmation before it's
considered "delivered" (typical for services like freight or installation,
which can't be goods-receipted the normal way).
**Why it exists:** a service charge shouldn't be payable/invoiceable until
someone confirms the service actually happened.
**Dependencies (cascading):**
- Reveals **Auto-confirm on main GRN** (can only be enabled if this is on).
- Reveals **Confirmation on partial GRN**: `PROPORTIONAL` (confirm % matches
  delivered % of qty) vs `FULL_ON_FIRST_GRN` (any delivery fully confirms it).
- In `GRNTab.tsx`: recording a GRN auto-updates the condition's status/percent
  confirmed according to these two settings; if auto-confirm is off, a user
  must **manually confirm** it.
- In `InvoiceTab.tsx`: a vendor's "Raise invoice" action is **blocked** with
  "Awaiting GRN confirmation" while any of that vendor's conditions still
  need confirmation and haven't received it — this is the main gate linking
  GRN activity to invoicing.

### Rate editable on PO
Toggle — whether the rate/amount can be changed when the condition is applied
to a specific PO, or is locked to the master's Default Rate.
**Why it exists:** statutory charges (duties, cess) usually shouldn't be
hand-edited per PO; commercial charges (discounts, freight rates) usually
should be negotiable per PO. Reflected in the Category presets (STAT = not
editable, everything else = editable).

### Vendor editable on PO
Toggle — intended to lock the vendor field on the PO-apply modal to the
Default Vendor. *(Defined on the template but not currently enforced in the
PO-apply form — a known gap between configuration intent and current
behavior.)*

### Requires Attachment
Toggle — intended to require a supporting document (e.g. a freight invoice)
before the condition can be saved. *(Not currently enforced as a blocking
check in the PO-apply flow.)*

### Reversible / Refundable
Toggle — marks a condition (typically retention/security deposit) as money
that will later be released back.
**Dependency:** reveals **Release Trigger**: `MANUAL` / `WARRANTY_EXPIRY` /
`COMMISSIONING` / `ON_DATE`. *(Lifecycle metadata; no release-processing
workflow is implemented yet.)*

### Min Value / Max Value
Numeric bounds on the rate/amount at PO-apply time.
**Why it exists:** a soft guard-rail against fat-finger entry or unusually
aggressive/lenient terms.
**Dependency:** at PO-apply time these are treated as **warnings, not hard
blocks** — below Min shows a warning, above Max shows "approval will be
required," but neither currently prevents saving.

### Approval Threshold
Numeric — intended to trigger an approval workflow above this amount.
*(Defined on the template; not yet read anywhere in the PO-apply validation
or approval flow.)*

### Index Reference / Revision Frequency / Revision Lag
Shown only when Calculation Basis = `SLAB`. Lets a slab-based rate track an
external index (e.g. a fuel price index) and revise on a schedule (monthly/
quarterly) with a lag. *(Descriptive only — no automatic revision job is
implemented yet.)*

### Applicability — Entities / Categories / Vendors
Multi-select scoping (which legal entities, spend categories, or vendors this
condition is meant for). *(Stored on the template; the PO-apply dropdown
currently lists all Active conditions regardless of these filters — not yet
enforced.)*

### Mandatory For (Incoterms)
Multi-select of Incoterms (EXW, FOB, CIF, CFR, DAP, DDP) this condition
should always accompany (e.g. insurance should be mandatory for CIF).
*(Not yet auto-enforced — no code currently force-adds a condition based on
a PO's Incoterm.)*

### Mutually Exclusive With
Multi-select of other condition codes that cannot coexist on the same line
(e.g. two different discount schemes).
**Dependency:** this one **is enforced** — applying a condition to a line
that already carries one of its listed "mutually exclusive" codes is blocked
at save time.

### Valid From / Valid To / Status
`Status`: `Active` / `Inactive` — only `Active` conditions appear in the
PO-apply dropdown. Valid From/To dates are stored but not currently checked
against the PO's date.

---

## How it all comes together (data flow)

```
ConditionMaster (template, this form)
        │  category picks a preset → prefills most fields
        ▼
AddConditionModal ("Add Conditions to Line Item")
        │  user picks a master, sets vendor / rate / qty / apply-to
        │  validated against vendorRule, mutuallyExclusiveWith, min/maxValue
        ▼
AppliedCondition (snapshot instance on the PO, line or header level)
        │
        ▼
engine/calc.ts
   ├─ computeConditionAmount()  → raw amount per calcBasis, then sign, rounding, GST
   ├─ computeLine() / computeHeaderCascade()  → dependency-ordered cascade, "Calculate On" chaining
   ├─ distributeAcrossLines()  → header amounts split per distributionBasis
   └─ computePO()  → PO totals, category totals, capitalised/landed cost,
                      GST totals, and per-vendor payables
        │
        ├──► ConditionCalcModal — read-only "how this was calculated" breakdown
        ├──► GRNTab — service-confirmation status, GRN-linked variance recalculation
        └──► InvoiceTab — vendor payables, GRN-confirmation gating, variance matching
```

---

## Fields configured here but not yet enforced downstream

These exist on the `ConditionMaster` type and are editable in this form, but
the current codebase does not (yet) act on them anywhere else — worth knowing
so you don't assume they're doing something they aren't:

- `vendorEditableOnPo`
- `requiresAttachment` (no real file-upload widget exists)
- `approvalThreshold`
- `taxCalculatedOn`
- `itcEligibilityPct`
- `tdsApplicable` / `tdsSection`
- `applicabilityEntities` / `applicabilityCategories` / `applicabilityVendors`
- `mandatoryFor` (Incoterms)
- `indexReferenceId` / `indexRevisionFrequency` / `indexRevisionLag`
- `reversible` / `releaseTrigger`
