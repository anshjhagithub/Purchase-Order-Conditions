import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Zap,
  ShoppingCart,
  Bell,
  Layers,
  ShieldCheck,
  GitBranch,
  Users2,
  Workflow,
  Grid3x3,
  Sparkles,
  SlidersHorizontal,
  Settings,
  Search,
  LogOut,
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  Banknote,
  CheckSquare,
  Lock,
  Building2,
  Wallet,
  FileSignature,
  ChevronDown,
  HandCoins,
  FileMinus,
  Landmark,
  Plane,
  UserCheck,
  Handshake,
  FileQuestion,
  BookOpen,
} from 'lucide-react';

const iconBtnCls = 'flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600';

type NavIcon = typeof LayoutDashboard;

interface SubItem {
  to: string;
  label: string;
  icon: NavIcon;
  // Defaults to an exact pathname match; only the control-room items need prefix
  // matching (sub-routes hang off them), so they pass this explicitly.
  isActive?: (pathname: string) => boolean;
}

interface SecondaryPanel {
  title: string;
  items: SubItem[];
}

interface PrimaryItem {
  key: string;
  to?: string;
  label: string;
  icon: NavIcon;
  // 'panel' items (Configuration Studio) open a distinct second sidebar column.
  panel?: SecondaryPanel;
  // 'inline' items (Organisation, Procurement) expand/collapse their children
  // directly beneath the row, within this same leftmost column — no second column.
  inlineChildren?: SubItem[];
}

interface PrimarySection {
  label?: string;
  items: PrimaryItem[];
}

const controlRoomPanel: SecondaryPanel = {
  title: 'Control Room',
  items: [
    { to: '/control-room/expense', label: 'Expense Configuration', icon: FileText },
    { to: '/control-room/invoices', label: 'Invoices Configuration', icon: Receipt },
    { to: '/control-room/utility', label: 'Utility Configuration', icon: Zap },
    { to: '/control-room/p2p', label: 'Procure to Pay Configuration', icon: Layers, isActive: (p) => p.startsWith('/control-room/p2p') },
    { to: '/control-room/notifications', label: 'Notification Module', icon: Bell },
    { to: '/control-room/super-category', label: 'Super Category', icon: Grid3x3 },
    { to: '/control-room/policies', label: 'Policies Configuration', icon: ShieldCheck },
    { to: '/control-room/form-builder', label: 'Form Builder', icon: Workflow },
    { to: '/control-room/access', label: 'Access Configuration', icon: Users2 },
    { to: '/control-room/other-workflow', label: 'Other Workflow', icon: GitBranch },
    { to: '/control-room/module', label: 'Module Configuration', icon: Grid3x3 },
    { to: '/control-room/dice-studio', label: 'Dice Studio', icon: Sparkles },
    { to: '/control-room/customization', label: 'Customization', icon: SlidersHorizontal },
    { to: '/control-room/global', label: 'Global Configuration', icon: Settings },
  ],
};

const procurementChildren: SubItem[] = [
  { to: '/app/procurement/pr', label: 'Purchase Request', icon: ClipboardList },
  { to: '/app/procurement/rfq', label: 'Request for Quotation', icon: FileQuestion },
  { to: '/po', label: 'Purchase Order', icon: ShoppingCart, isActive: (p) => p.startsWith('/po') },
  { to: '/app/procurement/vendor-catalog', label: 'Vendor Catalog', icon: BookOpen },
];

const organisationChildren: SubItem[] = [
  { to: '/app/organisation/entities', label: 'Entities', icon: Building2 },
  { to: '/app/organisation/cost-centers', label: 'Cost Centers', icon: Wallet },
  { to: '/app/organisation/departments', label: 'Departments', icon: Grid3x3 },
  { to: '/app/organisation/users-roles', label: 'Users & Roles', icon: Users2 },
];

const primaryNav: PrimarySection[] = [
  { items: [{ key: 'dashboard', to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Hierarchy & Enforcement',
    items: [
      { key: 'organisation', label: 'Organisation', icon: Building2, inlineChildren: organisationChildren },
      { key: 'configuration-studio', to: '/control-room/p2p', label: 'Configuration Studio', icon: Lock, panel: controlRoomPanel },
      { key: 'approvals', to: '/app/approvals', label: 'Approval Requests', icon: CheckSquare },
      { key: 'budget', to: '/app/budget', label: 'Budget Management', icon: Wallet },
    ],
  },
  {
    label: 'Travel & Expenses',
    items: [
      { key: 'expenses', to: '/app/expenses', label: 'Expenses', icon: FileText },
      { key: 'advances', to: '/app/advances', label: 'Advances', icon: Banknote },
    ],
  },
  {
    label: 'AP & Procurement',
    items: [
      { key: 'vendor-management', to: '/app/vendor-management', label: 'Vendor Management', icon: Users2 },
      { key: 'product-stock', to: '/app/product-stock', label: 'Product & Stock', icon: Boxes },
      { key: 'stock-transfer', to: '/app/stock-transfer', label: 'Stock & Transfer', icon: ArrowLeftRight },
      { key: 'invoice-management', to: '/app/invoice-management', label: 'Invoice Management', icon: Receipt },
      { key: 'procurement', label: 'Procurement', icon: ShoppingCart, inlineChildren: procurementChildren },
      { key: 'contract-management', to: '/app/contract-management', label: 'Contract Management', icon: FileSignature },
      { key: 'vendor-advance', to: '/app/vendor-advance', label: 'Vendor Advance', icon: HandCoins },
      { key: 'credit-note', to: '/app/credit-note', label: 'Credit Note', icon: FileMinus },
    ],
  },
  {
    label: 'Treasury & Finances',
    items: [
      { key: 'expense-vouchers', to: '/app/expense-vouchers', label: 'Expense Vouchers', icon: FileText },
      { key: 'account-payables', to: '/app/account-payables', label: 'Account Payables', icon: Landmark },
      { key: 'travel-bookings', to: '/app/travel-bookings', label: 'Travel Bookings', icon: Plane },
      { key: 'employee-settlements', to: '/app/employee-settlements', label: 'Employee Settlements', icon: UserCheck },
      { key: 'vendor-settlements', to: '/app/vendor-settlements', label: 'Vendor Settlements', icon: Handshake },
    ],
  },
];

const allPrimaryItems = primaryNav.flatMap((s) => s.items);

function subItemActive(item: SubItem, pathname: string): boolean {
  return (item.isActive ?? ((p: string) => p === item.to))(pathname);
}

function inlineHasActiveChild(children: SubItem[], pathname: string): boolean {
  return children.some((c) => subItemActive(c, pathname));
}

function SubNavRow({ item, active, indent }: { item: SubItem; active: boolean; indent?: boolean }) {
  return (
    <Link
      to={item.to}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition ${indent ? 'pl-9' : ''} ${
        active ? 'bg-lav-100 font-semibold text-indigo-brand' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      <item.icon size={indent ? 15 : 17} className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function PrimaryNavRow({
  item,
  active,
  expanded,
  onToggle,
  pathname,
}: {
  item: PrimaryItem;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  const cls = `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] transition ${
    active ? 'bg-lav-100 font-semibold text-indigo-brand' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
  }`;
  const content = (
    <>
      <item.icon size={17} className="shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {(item.panel || item.inlineChildren) && (
        <ChevronDown size={14} className={`shrink-0 transition-transform ${(item.inlineChildren ? expanded : active) ? 'rotate-180' : ''}`} />
      )}
    </>
  );

  if (item.inlineChildren) {
    return (
      <div className="flex flex-col gap-0.5">
        <button type="button" onClick={onToggle} className={cls}>
          {content}
        </button>
        {expanded && (
          <div className="flex flex-col gap-0.5">
            {item.inlineChildren.map((child, i) => (
              <SubNavRow key={child.label + i} item={child} active={subItemActive(child, pathname)} indent />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link to={item.to!} className={cls}>
      {content}
    </Link>
  );
}

export function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;

  const activePanel: SecondaryPanel | null = pathname.startsWith('/control-room') ? controlRoomPanel : null;

  // Auto-expand an inline section when the current route falls under it; the user can
  // still freely collapse/expand any section afterwards via manual toggles.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const initial = allPrimaryItems.find((item) => item.inlineChildren && inlineHasActiveChild(item.inlineChildren, pathname))?.key;
    return new Set(initial ? [initial] : []);
  });

  useEffect(() => {
    const activeKey = allPrimaryItems.find((item) => item.inlineChildren && inlineHasActiveChild(item.inlineChildren, pathname))?.key;
    if (activeKey) setExpandedKeys((prev) => (prev.has(activeKey) ? prev : new Set(prev).add(activeKey)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggle = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex h-screen shrink-0">
      <div className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="text-[15px] font-bold text-slate-900">Greencell Mobility</div>
          <div className="text-[11.5px] text-slate-400">dice.tech</div>
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <div className="text-[12.5px] font-semibold text-slate-700">Admin</div>
            <div className="text-[11px] text-slate-400">Procurement Owner</div>
          </div>
          <div className="flex items-center gap-0.5">
            <button className={iconBtnCls} title="Search">
              <Search size={15} />
            </button>
            <button className={iconBtnCls} title="Settings">
              <Settings size={15} />
            </button>
            <button className={iconBtnCls} title="Log out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
        <div className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
          <nav className="flex flex-col gap-4">
            {primaryNav.map((section, si) => (
              <div key={si} className="flex flex-col gap-0.5">
                {section.label && <div className="mb-1 px-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{section.label}</div>}
                {section.items.map((item) => (
                  <PrimaryNavRow
                    key={item.key}
                    item={item}
                    active={
                      item.panel
                        ? pathname.startsWith('/control-room')
                        : item.inlineChildren
                          ? inlineHasActiveChild(item.inlineChildren, pathname)
                          : pathname === item.to
                    }
                    expanded={expandedKeys.has(item.key)}
                    onToggle={() => toggle(item.key)}
                    pathname={pathname}
                  />
                ))}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {activePanel && (
        <div className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-2 px-3 text-[13px] font-bold text-slate-800">{activePanel.title}</div>
            <nav className="flex flex-col gap-0.5">
              {activePanel.items.map((item, i) => (
                <SubNavRow key={item.label + i} item={item} active={subItemActive(item, pathname)} />
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
