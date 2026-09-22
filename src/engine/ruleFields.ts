// Registry of selectable left-hand-side fields for a CONDITIONAL rule clause
// (types/index.ts RuleField / RuleClause). Shared by the rule-builder UI (dropdown
// options + value-kind for the right-hand input) and the engine (resolveFieldValue).
//
// Scope note: only fields that actually exist on this prototype's PurchaseOrder/POLine
// model (types/index.ts) are wired up. The PRD-style list (Plant, Project, Spend
// Category, ...) that don't exist yet as real PO/line attributes are intentionally
// left out rather than faked — add a row here + a case in resolveFieldValue's PO/LINE
// switch (engine/calc.ts) when that attribute exists on the data model.
import type { RuleField, RuleFieldSource } from '../types';
import type { ConditionCalcContext } from './calc';

export type RuleFieldValueType = 'NUMBER' | 'TEXT' | 'DATE';

export interface RuleFieldOption {
  source: RuleFieldSource;
  field: string;
  label: string;
  valueType: RuleFieldValueType;
}

export const PO_RULE_FIELDS: RuleFieldOption[] = [
  { source: 'PO', field: 'baseAmount', label: 'PO Base Amount', valueType: 'NUMBER' },
  { source: 'PO', field: 'currency', label: 'Currency', valueType: 'TEXT' },
  { source: 'PO', field: 'incoterm', label: 'Incoterm', valueType: 'TEXT' },
  { source: 'PO', field: 'vendorGroup', label: 'Vendor Group', valueType: 'TEXT' },
  { source: 'PO', field: 'entity', label: 'Entity', valueType: 'TEXT' },
  { source: 'PO', field: 'deliveryState', label: 'Delivery State', valueType: 'TEXT' },
  { source: 'PO', field: 'poDate', label: 'PO Date', valueType: 'DATE' },
];

export const LINE_RULE_FIELDS: RuleFieldOption[] = [
  { source: 'LINE', field: 'lineBase', label: 'Line Base', valueType: 'NUMBER' },
  { source: 'LINE', field: 'qty', label: 'Line Quantity', valueType: 'NUMBER' },
  { source: 'LINE', field: 'unitPrice', label: 'Unit Price', valueType: 'NUMBER' },
  { source: 'LINE', field: 'weight', label: 'Line Weight', valueType: 'NUMBER' },
  { source: 'LINE', field: 'volume', label: 'Line Volume', valueType: 'NUMBER' },
];

// The CONDITION option list is built by the caller (it depends on which other
// conditions exist / are active — see ConditionMasterForm's `lowerSequenceCodes`
// equivalent) and always resolves to that condition's CONDITION_AMOUNT.

export function ruleFieldKey(f: RuleField): string {
  return `${f.source}:${f.field}`;
}

export function ruleFieldLabel(f: RuleField, conditionNameByCode: Record<string, string> = {}): string {
  if (f.source === 'CONDITION') return `${conditionNameByCode[f.field] ?? f.field} (Condition Amount)`;
  const opt = [...PO_RULE_FIELDS, ...LINE_RULE_FIELDS].find((o) => o.source === f.source && o.field === f.field);
  return opt?.label ?? f.field;
}

export function ruleFieldValueType(f: RuleField): RuleFieldValueType {
  if (f.source === 'CONDITION') return 'NUMBER';
  const opt = [...PO_RULE_FIELDS, ...LINE_RULE_FIELDS].find((o) => o.source === f.source && o.field === f.field);
  return opt?.valueType ?? 'TEXT';
}

// Resolves a RuleField's runtime value against a condition-calc context — the single
// place CONDITIONAL-rule clauses read PO/line attributes or another condition's amount.
// `ConditionCalcContext` is imported type-only, so this doesn't create a runtime
// calc.ts <-> ruleFields.ts import cycle (only calc.ts's raw amounts depend on this
// module's exports at runtime; the reverse is type information only, erased on build).
export function resolveFieldValue(field: RuleField, ctx: ConditionCalcContext): string | number | undefined {
  if (field.source === 'CONDITION') return ctx.priorAmounts[field.field] ?? 0;
  if (field.source === 'PO') {
    switch (field.field) {
      case 'baseAmount':
        return ctx.poBaseAmount ?? ctx.lineBaseValue;
      case 'currency':
        return ctx.currency ?? '';
      case 'incoterm':
        return ctx.incoterm ?? '';
      case 'vendorGroup':
        return ctx.vendorGroup ?? '';
      case 'entity':
        return ctx.entityId ?? '';
      case 'deliveryState':
        return ctx.deliveryState ?? '';
      default:
        return undefined;
    }
  }
  // LINE
  switch (field.field) {
    case 'lineBase':
      return ctx.lineBaseValue;
    case 'qty':
      return ctx.lineQty;
    case 'unitPrice':
      return ctx.lineQty ? ctx.lineBaseValue / ctx.lineQty : 0;
    case 'weight':
      return ctx.lineQty * ctx.unitWeightKg;
    case 'volume':
      return ctx.lineQty * ctx.unitVolumeCbm;
    default:
      return undefined;
  }
}
