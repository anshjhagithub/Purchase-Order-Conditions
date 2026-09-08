import { useState } from 'react';
import { MoreVertical, Plus, Layers2, Lock, Trash2, Info } from 'lucide-react';
import type { PurchaseOrder } from '../../../types';
import { useData } from '../../../context/DataContext';
import { computePO, formatCurrency, type ComputedConditionLine } from '../../../engine/calc';
import { VENDORS, UOMS } from '../../../data/seed';
import { CategoryBadge, StatusBadge } from '../../../components/ui/Badge';
import { CALC_BASIS_LABELS } from '../../../types';
import { AddConditionModal } from '../AddConditionModal';
import { BundleAndCopy } from '../BundleAndCopy';
import { PoSummaryBlock } from '../PoSummaryBlock';
import { ConditionCalcModal } from '../ConditionCalcModal';

// Filters a condition out of whichever it lives in — a line's own list or the header list.
function removeConditionFromPO(po: PurchaseOrder, conditionId: string): PurchaseOrder {
  return {
    ...po,
    lines: po.lines.map((l) => ({ ...l, conditions: l.conditions.filter((c) => c.id !== conditionId) })),
    headerConditions: po.headerConditions.filter((c) => c.id !== conditionId),
  };
}

export function LineItemsTab({ po }: { po: PurchaseOrder }) {
  const { upsertPO } = useData();
  const [openMenuLineId, setOpenMenuLineId] = useState<string | null>(null);
  const [addModalLineId, setAddModalLineId] = useState<string | null | 'HEADER'>(null);
  const [infoItem, setInfoItem] = useState<{ item: ComputedConditionLine; lineLabel: string; nameByCode: Record<string, string> } | null>(null);
  const isDraft = po.stage === 'Draft';
  const lockedTitle = `Locked — PO is ${po.stage}. Conditions can only be added or removed while the PO is in Draft.`;

  const comp = computePO(po, VENDORS);

  // "Calculate On" references condition codes within the same scope (a line's own conditions,
  // or the header's own conditions) — scope the code→name lookup accordingly for the info modal.
  const headerNameByCode = Object.fromEntries(comp.headerComputation.items.map((i) => [i.conditionCode, i.conditionName]));

  const flatRows = [
    ...comp.lineComputations.flatMap((lc) => {
      const nameByCode = Object.fromEntries(lc.items.map((i) => [i.conditionCode, i.conditionName]));
      return lc.items.map((item) => ({
        item,
        lineLabel: `#${po.lines.find((l) => l.id === item.lineId)?.lineNo} ${po.lines.find((l) => l.id === item.lineId)?.itemName}`,
        nameByCode,
      }));
    }),
    ...comp.headerComputation.items.map((item) => ({ item, lineLabel: 'Whole PO', nameByCode: headerNameByCode })),
  ].sort((a, b) => a.item.sequence - b.item.sequence);

  const handleRemoveCondition = (conditionName: string, conditionId: string) => {
    if (window.confirm(`Remove "${conditionName}" from this PO?`)) {
      upsertPO(removeConditionFromPO(po, conditionId));
    }
  };

  return (
    <div className="space-y-6">
      {!isDraft && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
          <Lock size={15} /> Conditions are locked — this PO is in <strong>{po.stage}</strong>. Only Draft POs can have conditions added (P0).
        </div>
      )}

      {/* Line items */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[15px] font-bold text-slate-800">Line Items</div>
          <button className="btn-dark !py-2 !text-[12.5px]">Short Closure</button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3 text-[13px] font-bold text-slate-700">As Per Purchase Order</div>
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Details</th>
                  <th>Delivery Address</th>
                  <th>Qty/Unit</th>
                  <th>Price/Unit</th>
                  <th>Delivered</th>
                  <th>Invoice Qty</th>
                  <th>Balance Qty</th>
                  <th>Conditions</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((line) => {
                  const balance = line.qty - line.deliveredQty;
                  return (
                    <tr key={line.id} className="relative">
                      <td>
                        <div className="font-semibold text-slate-800">{line.itemName}</div>
                        <div className="text-[11.5px] leading-snug text-slate-400">
                          Item Ref no: {line.itemRef}
                          <br />
                          HSN: {line.hsn}
                          <br />
                          Delivery Date: {new Date(line.deliveryDate).toLocaleDateString('en-IN')}
                        </div>
                      </td>
                      <td className="text-[12.5px] text-slate-500">{line.deliveryAddress}</td>
                      <td>
                        {line.qty} {line.uom}
                      </td>
                      <td>{formatCurrency(line.unitPrice, po.currency)}</td>
                      <td>{line.deliveredQty}</td>
                      <td>{line.invoiceQty}</td>
                      <td className={balance > 0 ? 'font-semibold text-amber-600' : 'font-semibold text-emerald-600'}>{balance}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span>{line.conditions.length}</span>
                          <button
                            onClick={() => setAddModalLineId(line.id)}
                            disabled={!isDraft}
                            title={isDraft ? 'Add condition to this line' : lockedTitle}
                            className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-brand transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-indigo-50"
                          >
                            <Plus size={11} /> Add
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuLineId(openMenuLineId === line.id ? null : line.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openMenuLineId === line.id && (
                            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                              <div className="px-3 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Quick Actions</div>
                              <MenuItem label="Edit" />
                              <MenuItem label="Remove" />
                              <MenuItem label="Update Owner" />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Total Items</th>
                  <th>Total Qty</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold text-slate-700">Main Item</td>
                  <td>{po.lines.length}</td>
                  <td>{po.lines.reduce((s, l) => s + l.qty, 0).toLocaleString('en-IN')} units</td>
                  <td className="font-semibold">{formatCurrency(comp.baseAmount, po.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Amendments — no revision workflow modelled in this prototype yet, matches the real
          product's empty state rather than fabricating amendment history. */}
      <div>
        <div className="mb-2 text-[13px] font-bold text-slate-700">Amendments</div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Details</th>
                <th>Delivery Address</th>
                <th>GST</th>
                <th>Qty/Unit</th>
                <th>Amend Quantity</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No Amendments
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Flat condition display columns (PRD §9) */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[13px] font-bold text-slate-700">Conditions</div>
          <BundleAndCopy po={po} targetLineId={po.lines[0]?.id} onUpdate={upsertPO} disabled={!isDraft} />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Seq</th>
                <th>Condition</th>
                <th>Category</th>
                <th>Line</th>
                <th>Vendor</th>
                <th>Basis</th>
                <th>Rate</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>GST%</th>
                <th>GST Amt</th>
                <th>Total</th>
                <th>Landed</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map(({ item, lineLabel, nameByCode }) => (
                <tr key={item.id}>
                  <td>{item.sequence}</td>
                  <td className="font-medium text-slate-800">
                    <div className="flex items-center gap-1.5">
                      {item.conditionName}
                      <button
                        onClick={() => setInfoItem({ item, lineLabel, nameByCode })}
                        title="How is this amount calculated?"
                        className="rounded-full p-0.5 text-slate-300 transition hover:bg-indigo-50 hover:text-indigo-brand"
                      >
                        <Info size={13} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <CategoryBadge category={item.category} short />
                  </td>
                  <td className="text-[12px] text-slate-500">{lineLabel}</td>
                  <td className="text-[12px]">{item.vendorName}</td>
                  <td className="text-[12px]">{CALC_BASIS_LABELS[item.calcBasis]}</td>
                  <td>{item.rate}</td>
                  <td>{item.qty}</td>
                  <td className={item.computedAmount < 0 ? 'font-semibold text-rose-600' : 'font-semibold'}>{formatCurrency(item.computedAmount, po.currency)}</td>
                  <td>{item.gstRate}%</td>
                  <td>
                    {formatCurrency(item.computedGstAmount, po.currency)}
                    {item.jurisdiction === 'RCM' && <span className="ml-1 text-[10px] text-amber-600">RCM</span>}
                  </td>
                  <td className="font-semibold">{formatCurrency(item.computedAmount + (item.jurisdiction === 'RCM' ? 0 : item.computedGstAmount), po.currency)}</td>
                  <td>{item.capitalise ? 'Yes' : 'No'}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>
                    <button
                      onClick={() => handleRemoveCondition(item.conditionName, item.id)}
                      disabled={!isDraft}
                      title={isDraft ? 'Remove condition from PO' : lockedTitle}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {flatRows.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-8 text-center text-slate-400">
                    No conditions added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Header conditions add */}
      <div className="flex items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4">
        <div className="flex items-center gap-2 text-[13px] text-slate-500">
          <Layers2 size={16} /> Header conditions apply once to the whole PO and distribute across lines by their configured basis.
        </div>
        <button onClick={() => setAddModalLineId('HEADER')} disabled={!isDraft} title={isDraft ? undefined : lockedTitle} className="btn-secondary !py-2">
          <Plus size={14} /> Add Header Condition
        </button>
      </div>

      <PoSummaryBlock po={po} comp={comp} />

      {addModalLineId && isDraft && (
        <AddConditionModal
          po={po}
          contextLineId={addModalLineId === 'HEADER' ? undefined : addModalLineId}
          onClose={() => setAddModalLineId(null)}
          onSave={upsertPO}
        />
      )}

      {infoItem && (
        <ConditionCalcModal
          item={infoItem.item}
          lineLabel={infoItem.lineLabel}
          nameByCode={infoItem.nameByCode}
          uomName={UOMS.find((u) => u.id === infoItem.item.uomId)?.name}
          currency={po.currency}
          onClose={() => setInfoItem(null)}
        />
      )}
    </div>
  );
}

function MenuItem({ label, highlight, onClick }: { label: string; highlight?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-3.5 py-2 text-left text-[13px] hover:bg-slate-50 ${highlight ? 'font-semibold text-indigo-brand' : 'text-slate-600'}`}
    >
      {label}
    </button>
  );
}
