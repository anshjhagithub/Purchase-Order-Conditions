import { useState } from 'react';
import { FileSpreadsheet, Plus } from 'lucide-react';
import type { PurchaseOrder } from '../../../types';
import { computePO, formatCurrency } from '../../../engine/calc';
import { VENDORS, OFFICES } from '../../../data/seed';
import { Modal } from '../../../components/ui/Modal';

interface Invoice {
  number: string;
  amount: number;
  date: string;
  status: 'POHOLD' | 'PAID';
}

// This prototype doesn't model discrete invoice records — a PO that has reached
// Invoice Pending / Closed implies exactly one invoice has been raised against it,
// so derive that single invoice from the PO itself rather than a separate store.
function invoiceFor(po: PurchaseOrder, amount: number): Invoice | null {
  if (po.stage === 'Invoice Pending') return { number: `VI-${po.poNumber.replace('PO-', '')}`, amount, date: po.createdAt, status: 'POHOLD' };
  if (po.stage === 'Closed') return { number: `VI-${po.poNumber.replace('PO-', '')}`, amount, date: po.createdAt, status: 'PAID' };
  return null;
}

export function InvoiceTab({ po }: { po: PurchaseOrder }) {
  const comp = computePO(po, VENDORS);
  const office = OFFICES.find((o) => o.name === po.office);
  const invoice = invoiceFor(po, comp.poTotal);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-bold text-slate-800">Invoices</div>
        <button title="Raise a new invoice — not wired up in this prototype" className="rounded-full bg-slate-100 p-1.5 text-slate-500">
          <Plus size={15} />
        </button>
      </div>

      {invoice ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-72 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-indigo-200 hover:shadow-md"
        >
          <div className="flex h-12 w-10 items-center justify-center rounded bg-emerald-500 text-white">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <div className="text-[13.5px] font-bold text-slate-800">{invoice.number}</div>
            <div className="text-[15px] font-bold text-slate-900">{formatCurrency(invoice.amount, po.currency)}</div>
          </div>
          <span className={`badge self-start ${invoice.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{invoice.status}</span>
        </button>
      ) : (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white text-center">
          <FileSpreadsheet size={24} className="text-slate-300" />
          <div className="text-[13px] text-slate-400">No invoices submitted against this PO yet.</div>
        </div>
      )}

      {invoice && (
        <Modal open={open} onClose={() => setOpen(false)} title={invoice.number} subtitle={formatCurrency(invoice.amount, po.currency)} width={480}>
          <div className="space-y-2.5 text-[13px]">
            <Row label="Vendor" value={po.vendorName} />
            <Row label="Owner" value={po.owner} />
            <Row label="Date" value={new Date(invoice.date).toLocaleDateString('en-IN')} />
            <Row label="Category" value={po.spendCategory} />
            <Row label="Service" value={po.spendSuperCategory} />
            <Row label="Billing Address" value={office?.address ?? po.deliveryAddress} />
            <Row label="Status" value={invoice.status} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
