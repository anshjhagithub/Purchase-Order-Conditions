import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings2, Filter, Download, Upload, LayoutGrid, ChevronLeft, ChevronRight, MoreVertical, Eye } from 'lucide-react';
import { useData } from '../context/DataContext';
import { computePO, formatCurrency } from '../engine/calc';
import { VENDORS } from '../data/seed';
import { PoStageBadge } from '../components/ui/Badge';
import type { POStage, PurchaseOrder } from '../types';

const PAGE_SIZE = 15;
const PAST_STAGES: POStage[] = ['Closed'];
const TABS = ['Pending', 'Past', 'All Orders'] as const;
type Tab = (typeof TABS)[number];

function formatCreatedOn(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${day} ${month} ${d.getFullYear()} ${hours}:${minutes} ${ampm}`;
}

function downloadCsv(rows: { po: PurchaseOrder; amount: number }[]) {
  const headers = ['PO Number', 'Vendor Name', 'Super Category', 'Category', 'Office', 'Status', 'Created On', 'Submitted By', 'Amount'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map(({ po, amount }) =>
    [po.poNumber, po.vendorName, po.spendSuperCategory, po.spendCategory, po.office, po.stage, formatCreatedOn(po.createdAt), po.submittedBy, amount.toFixed(2)]
      .map((v) => escape(String(v)))
      .join(',')
  );
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'purchase-orders.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function Dashboard() {
  const { purchaseOrders } = useData();
  const [tab, setTab] = useState<Tab>('Pending');
  const [page, setPage] = useState(1);

  const rows = useMemo(() => purchaseOrders.map((po) => ({ po, amount: computePO(po, VENDORS).poTotal })), [purchaseOrders]);

  const pendingRows = rows.filter((r) => !PAST_STAGES.includes(r.po.stage));
  const pastRows = rows.filter((r) => PAST_STAGES.includes(r.po.stage));
  const scopedRows = tab === 'Pending' ? pendingRows : tab === 'Past' ? pastRows : rows;

  const sortedRows = [...scopedRows].sort((a, b) => new Date(b.po.createdAt).getTime() - new Date(a.po.createdAt).getTime());
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeTab = (t: Tab) => {
    setTab(t);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-[1500px] px-8 py-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Procure to Pay</div>
          <h1 className="text-[24px] font-bold text-slate-900">Purchase Orders</h1>
          <p className="mt-1.5 text-[13.5px] text-slate-500">
            Multi-condition POs — pricing, logistics, statutory and deduction conditions, all in one cascade.
          </p>
        </div>
        <Link to="/control-room/p2p/conditions" className="btn-secondary">
          <Settings2 size={15} /> Configure PO Conditions
        </Link>
      </div>

      <div className="mt-6 flex gap-6 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => changeTab(t)}
            className={`relative pb-3 text-[13.5px] font-semibold transition ${tab === t ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {t}
            {tab === t && <span className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full bg-slate-900" />}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <button className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-slate-800">
          <Filter size={14} /> Filter
        </button>
        <span className="text-[13px] text-slate-400">
          {sortedRows.length} {tab} PO{sortedRows.length !== 1 ? 's' : ''}
        </span>
        <button className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-slate-800">
          <LayoutGrid size={14} /> List View
        </button>
        <button
          onClick={() => downloadCsv(sortedRows)}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-slate-800"
        >
          <Download size={14} /> Download Csv
        </button>
        <button className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-slate-800">
          <Upload size={14} /> Upload Csv
        </button>
        <button className="ml-auto flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 hover:text-slate-800">
          <Settings2 size={14} /> Manage Table View
        </button>
      </div>

      <div className="mt-4">
        <button className="btn-dark">+ Create Order</button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="table-shell">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Vendor Name</th>
              <th>Super Category</th>
              <th>Category</th>
              <th>Office</th>
              <th>Status</th>
              <th>Created On</th>
              <th>Submitted By</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(({ po, amount }) => (
              <tr key={po.id}>
                <td>
                  <Link to={`/po/${po.id}`} className="inline-flex items-center gap-1.5 font-semibold text-slate-800 hover:text-indigo-brand">
                    <Eye size={13} className="text-slate-300" /> {po.poNumber}
                  </Link>
                </td>
                <td>{po.vendorName}</td>
                <td className="text-[12.5px] text-slate-500">{po.spendSuperCategory}</td>
                <td className="text-[12.5px] text-slate-500">{po.spendCategory}</td>
                <td className="text-[12.5px] text-slate-500">{po.office}</td>
                <td>
                  <PoStageBadge stage={po.stage} />
                </td>
                <td className="text-[12.5px] text-slate-500">{formatCreatedOn(po.createdAt)}</td>
                <td className="text-[12.5px] text-slate-500">{po.submittedBy}</td>
                <td className="font-semibold">{formatCurrency(amount, po.currency)}</td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <Link to={`/po/${po.id}`} className="btn-secondary !px-3 !py-1.5 text-[12px]">
                      <Eye size={12} /> View
                    </Link>
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                      <MoreVertical size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-400">
                  No purchase orders in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-semibold transition ${
                p === currentPage ? 'bg-indigo-brand text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={currentPage === pageCount}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
