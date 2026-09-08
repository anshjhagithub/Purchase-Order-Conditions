import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Settings, Info, Construction, SquareStack } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { Toggle } from '../../components/ui/Form';

const P2P_TABS = ['Configuration', 'PR', 'RFQ', 'PO', 'GRN', 'Contract'] as const;
type P2PTab = (typeof P2P_TABS)[number];

interface ModuleDef {
  key: string;
  title: string;
  description: string;
  defaultEnabled: boolean;
  viewModuleTo?: string;
}

function poModules(conditionCount: number): ModuleDef[] {
  return [
    { key: 'po-type', title: 'PO Type', description: 'Enable to configure predefined PO types for selection during PO creation.', defaultEnabled: true, viewModuleTo: '/control-room/p2p/po-type' },
    { key: 'invoice-qty-restriction', title: 'Invoice Po Qty Restriction', description: 'Enable this plugin if you want to restrict invoice quantity is not greater than po quantity.', defaultEnabled: true },
    { key: 'po-grn-tagging', title: 'PO Grn Tagging', description: 'Enable this plugin to allow PO Grn Tagging.', defaultEnabled: false },
    { key: 'inventory-tracking', title: 'Inventory Tracking across platform', description: 'Enable to track inventory across multiple modules within the platform.', defaultEnabled: false },
    { key: 'direct-tagging', title: 'Direct Tagging', description: 'Enable this plugin if you want to enable direct owner tagging.', defaultEnabled: false },
    {
      key: 'conditional-po',
      title: 'Conditional PO',
      description: `Enable this plugin to configure multi-condition charge lines on a PO — discounts, surcharges, freight, duty and deductions. ${conditionCount} condition${conditionCount !== 1 ? 's' : ''} configured.`,
      defaultEnabled: true,
      viewModuleTo: '/control-room/p2p/conditions',
    },
    { key: 'custom-po-number', title: 'Custom PO Number', description: 'Enable this plugin if you want to enable Custom PO Number.', defaultEnabled: false },
    { key: 'renewal-tracking', title: 'Renewal Tracking', description: 'Enable this if you want to enable renewal Tracking.', defaultEnabled: false },
    { key: 'auto-billing-address', title: 'Enable Auto Billing Address', description: 'Enable this if you want to enable Auto Billing Address on PO creation.', defaultEnabled: false },
    { key: 'refresh-po-on-approve', title: 'Refresh PO on Approve', description: 'Enable to automatically update the PO PDF with the latest data on approval.', defaultEnabled: false },
    { key: 'direct-po', title: 'Direct PO', description: 'Enable this plugin if you want to disable to PR → RFQ path and raise a PO directly.', defaultEnabled: false },
    { key: 'restricted-pr-change', title: 'Restricted PR change', description: 'Enable to enforce an approval workflow for any change to a PR after it is linked to a PO.', defaultEnabled: false },
  ];
}

function ModuleCard({ mod, enabled, onToggle }: { mod: ModuleDef; enabled: boolean; onToggle: (v: boolean) => void }) {
  const showButton = enabled && !!mod.viewModuleTo;
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${enabled ? 'bg-slate-100 text-slate-800' : 'bg-slate-50 text-slate-300'}`}>
          <SquareStack size={20} />
        </div>
        <div className="flex items-center gap-1.5">
          <Toggle checked={enabled} onChange={onToggle} />
          <Info size={13} className="text-slate-300" />
        </div>
      </div>
      <div className={`mt-4 text-[15px] font-bold leading-snug ${enabled ? 'text-slate-900' : 'text-slate-300'}`}>{mod.title}</div>
      <p className={`mt-1.5 flex-1 text-[12px] leading-snug ${enabled ? 'text-slate-500' : 'text-slate-300'}`}>{mod.description}</p>
      {showButton && (
        <Link
          to={mod.viewModuleTo!}
          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-100 px-4 py-2.5 text-[12.5px] font-semibold text-rose-800 transition hover:bg-rose-200"
        >
          <Settings size={13} /> View Module
        </Link>
      )}
    </div>
  );
}

function TabPlaceholder({ tab }: { tab: P2PTab }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Construction size={26} />
      </div>
      <div className="text-[15px] font-bold text-slate-700">{tab} Config</div>
      <div className="max-w-sm text-[13px] text-slate-400">
        Out of scope for this prototype — only Procure to Pay Configuration → PO → Conditional PO is wired up.
      </div>
    </div>
  );
}

export function P2PConfigHub() {
  const { conditionMasters } = useData();
  const activeConditions = conditionMasters.filter((c) => c.status === 'Active').length;
  const [tab, setTab] = useState<P2PTab>('PO');
  const [query, setQuery] = useState('');
  const [enabledState, setEnabledState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(poModules(activeConditions).map((m) => [m.key, m.defaultEnabled]))
  );

  const modules = useMemo(() => poModules(activeConditions), [activeConditions]);
  const filteredModules = modules.filter((m) => m.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mx-auto max-w-[1300px] px-8 py-8">
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Control Room</div>
      <h1 className="text-[24px] font-bold text-slate-900">Procure to Pay Configuration</h1>

      <div className="mt-5 flex gap-6 border-b border-slate-200">
        {P2P_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative pb-3 text-[13.5px] font-semibold transition ${tab === t ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {t}
            {tab === t && <span className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full bg-slate-900" />}
          </button>
        ))}
      </div>

      {tab === 'PO' ? (
        <>
          <div className="mt-6 flex items-start justify-between">
            <div>
              <div className="text-[18px] font-bold text-slate-900">PO Config</div>
              <p className="mt-1 text-[13px] text-slate-400">All PO configuration are available below.</p>
            </div>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search PO Modules"
                className="w-72 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 pl-9 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-5">
            {filteredModules.map((m) => (
              <ModuleCard
                key={m.key}
                mod={m}
                enabled={enabledState[m.key] ?? m.defaultEnabled}
                onToggle={(v) => setEnabledState((prev) => ({ ...prev, [m.key]: v }))}
              />
            ))}
            {filteredModules.length === 0 && (
              <div className="col-span-4 py-10 text-center text-[13px] text-slate-400">No modules match "{query}".</div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-6">
          <TabPlaceholder tab={tab} />
        </div>
      )}
    </div>
  );
}
