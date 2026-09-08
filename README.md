# PO Conditions — Prototype

Clickable prototype for the multi-condition Purchase Order feature.
Spec: [`../10-product/PO-Conditions-PRD.md`](../10-product/PO-Conditions-PRD.md)

## Run

```bash
npm install    # node_modules is not committed
npm run dev    # Vite dev server
```

| Script | Does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · react-router-dom v7 · lucide-react

State is in-memory via `src/context/DataContext.tsx`. No backend, no persistence — refreshing resets to seed data.

## Where things are

| Path | Role | PRD ref |
|---|---|---|
| `src/types/index.ts` | Core data model — **start here** | §3–§5 |
| `src/data/categoryPresets.ts` | Category → default field presets | §7 |
| `src/data/seed.ts` | Seed condition masters + demo PO | — |
| `src/pages/ConditionMaster/ConditionMasterForm.tsx` | Master creation form | §4 |
| `src/pages/ConditionMaster/ConditionMasterList.tsx` | Master list | — |
| `src/pages/PO/PODetail.tsx` | PO detail shell + tabs | — |
| `src/pages/PO/AddConditionModal.tsx` | Add condition to line item | §9 |
| `src/pages/PO/PoSummaryBlock.tsx` | Vendor-wise payable + landed cost split | §9 |
| `src/pages/PO/BundleAndCopy.tsx` | Condition bundles / copy from previous PO | §9 |

## v0

`v0-html-mockup/index.html` — earlier single-file HTML mockup. Superseded, kept for reference.

## Rule

The PRD is authoritative. If the prototype and PRD disagree, that's drift — run the `spec-check` skill and fix the prototype, or update the PRD deliberately with an ADR.
