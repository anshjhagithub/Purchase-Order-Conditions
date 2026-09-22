import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Plus, Pencil, Search, RotateCcw, Trash2, Trash, Undo2 } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { CATEGORY_LABELS, CALC_BASIS_LABELS, CALCULATION_MODE_LABELS, type CategoryCode, type ConditionMaster } from '../../types';
import { CategoryBadge, StatusBadge } from '../../components/ui/Badge';
import { ConditionMasterForm } from './ConditionMasterForm';

export function ConditionMasterList() {
  const { conditionMasters, resetDemoData, setConditionMasterStatus, deleteConditionMasterPermanently } = useData();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryCode | 'ALL'>('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<ConditionMaster | null>(null);
  const [creating, setCreating] = useState(false);

  const inactiveCount = useMemo(() => conditionMasters.filter((c) => c.status === 'Inactive').length, [conditionMasters]);

  const statusScoped = useMemo(
    () => conditionMasters.filter((c) => showInactive || c.status === 'Active'),
    [conditionMasters, showInactive]
  );

  const filtered = useMemo(() => {
    return statusScoped.filter((c) => {
      if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
      if (query && !`${c.code} ${c.name}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [statusScoped, query, categoryFilter]);

  const handleDelete = (c: ConditionMaster) => {
    if (window.confirm(`Delete "${c.name}"? It disappears from pickers immediately; any PO already using it keeps resolving (PRD §5.25).`)) {
      setConditionMasterStatus(c.id, 'Inactive');
    }
  };

  const handlePermanentDelete = (c: ConditionMaster) => {
    if (window.confirm(`Permanently delete "${c.name}" (${c.code})? This cannot be undone — the record cannot be restored (ADR-005).`)) {
      deleteConditionMasterPermanently(c.id);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <Link to="/control-room/p2p" className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-slate-500 hover:text-slate-700">
        <ChevronLeft size={16} /> Procure to Pay Configuration
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900">PO Conditions</h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] text-slate-500">
            Condition master — category is the master switch that presets sign, vendor rules, capitalisation, and tax
            treatment for every charge line raised on a PO.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={resetDemoData} className="btn-secondary !px-3" title="Reset demo data">
            <RotateCcw size={15} />
          </button>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus size={16} /> Add Custom PO Condition
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code or name…"
            className="field-input !w-64 !pl-9"
          />
        </div>
        <button
          onClick={() => setCategoryFilter('ALL')}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
            categoryFilter === 'ALL' ? 'border-indigo-brand bg-indigo-brand text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          All ({statusScoped.length})
        </button>
        {(Object.keys(CATEGORY_LABELS) as CategoryCode[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
              categoryFilter === cat ? 'border-indigo-brand bg-indigo-brand text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            {CATEGORY_LABELS[cat]} ({statusScoped.filter((c) => c.category === cat).length})
          </button>
        ))}
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`ml-auto rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
            showInactive ? 'border-indigo-brand bg-indigo-brand text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          Show inactive ({inactiveCount})
        </button>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Calculation Basis</th>
              <th>Sign</th>
              <th>Calculate On</th>
              <th>Vendor Rule</th>
              <th>Capitalise</th>
              <th>Level</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => setEditing(c)}
                title="View condition details"
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="font-mono text-[12px] font-semibold text-slate-500">{c.code}</td>
                <td className="font-medium text-slate-800">{c.name}</td>
                <td>
                  <CategoryBadge category={c.category} />
                </td>
                <td>{CALC_BASIS_LABELS[c.calcBasis]}</td>
                <td>
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded font-bold ${c.sign === '-' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {c.sign}
                  </span>
                </td>
                <td className="text-[12px] text-slate-500">{CALCULATION_MODE_LABELS[c.calculationMode ?? (c.calculateOn === 'SELECTED' ? 'SELECTED_CONDITIONS' : 'BASE')]}</td>
                <td className="text-[12.5px]">{c.vendorRule.replace(/_/g, ' ').toLowerCase()}</td>
                <td>{c.capitalise ? 'Yes' : 'No'}</td>
                <td>{c.allowedLevel}</td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(c)} title="View / edit details" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                      <Pencil size={15} />
                    </button>
                    {c.status === 'Active' ? (
                      <button onClick={() => handleDelete(c)} title="Delete" className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 size={15} />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setConditionMasterStatus(c.id, 'Active')}
                          title="Restore"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                        >
                          <Undo2 size={15} />
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(c)}
                          disabled={c.usedOnAnyPo}
                          title={c.usedOnAnyPo ? 'Used on a PO — cannot be permanently deleted (ADR-005)' : 'Delete permanently — cannot be undone'}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                          <Trash size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="py-10 text-center text-slate-400">
                  No conditions match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <ConditionMasterForm
          existing={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
