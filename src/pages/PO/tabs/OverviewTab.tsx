import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import type { PurchaseOrder, Vendor } from '../../../types';
import { computePO, formatCurrency } from '../../../engine/calc';
import { VENDORS, ENTITIES, OFFICES } from '../../../data/seed';
import { poStageShortLabel } from '../../../components/ui/Badge';

const STAT_THEME: Record<'status' | 'raisedBy' | 'category' | 'amount', { bg: string; text: string }> = {
  status: { bg: 'bg-mint-100', text: 'text-emerald-800' },
  raisedBy: { bg: 'bg-cream-100', text: 'text-amber-900' },
  category: { bg: 'bg-rose-50', text: 'text-rose-800' },
  amount: { bg: 'bg-slate-100', text: 'text-slate-800' },
};

function StatCard({ theme, value, label }: { theme: keyof typeof STAT_THEME; value: string; label: string }) {
  const t = STAT_THEME[theme];
  return (
    <div className={`rounded-2xl ${t.bg} p-5`}>
      <div className={`text-[16px] font-bold ${t.text}`}>{value}</div>
      <div className={`mt-1 text-[12px] font-medium ${t.text} opacity-70`}>{label}</div>
    </div>
  );
}

function DetailLine({ children }: { children: ReactNode }) {
  return <div className="break-words text-[12.5px] leading-relaxed text-slate-500">{children}</div>;
}

// Vendor master doesn't carry contact details for every raw-material supplier —
// derive a plausible, stable one from the vendor record so the Supplier Details
// card always has something real-looking to show instead of blank fields.
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function vendorContact(vendor: Vendor): { email: string; phone: string; address: string } {
  const slug = vendor.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const digits = String(Math.abs(hashCode(vendor.id)) % 1_000_000_000).padStart(9, '0');
  return {
    email: vendor.email ?? `procurement@${slug}.com`,
    phone: vendor.phone ?? `+91 9${digits}`,
    address: vendor.address ?? `${vendor.state}, India`,
  };
}

export function OverviewTab({ po }: { po: PurchaseOrder }) {
  const comp = computePO(po, VENDORS);
  const vendor = VENDORS.find((v) => v.id === po.vendorId);
  const entity = ENTITIES.find((e) => e.id === po.entityId);
  const office = OFFICES.find((o) => o.name === po.office);
  const contact = vendor ? vendorContact(vendor) : { email: '—', phone: '—', address: '—' };

  const isDelivered = po.stage === 'Goods Receipt Pending' || po.stage === 'Invoice Pending' || po.stage === 'Closed';
  const grnOwner = isDelivered ? po.submittedBy : undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard theme="status" value={poStageShortLabel(po.stage)} label="Status" />
        <StatCard theme="raisedBy" value={po.createdBy} label="Raised By" />
        <StatCard theme="category" value={po.spendCategory} label="Category" />
        <StatCard theme="amount" value={formatCurrency(comp.poTotal, po.currency)} label="Amount" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-1 text-[13px] font-bold text-slate-400">Supplier Details</div>
          <div className="mb-2 text-[15px] font-bold text-slate-900">{po.vendorName}</div>
          <div className="space-y-1">
            <DetailLine>Email: {contact.email}</DetailLine>
            <DetailLine>Mobile: {contact.phone}</DetailLine>
            <DetailLine>GSTIN: {vendor?.gstin ?? 'Not available'}</DetailLine>
            <DetailLine>Address: {contact.address}</DetailLine>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-1 text-[13px] font-bold text-slate-400">Billing Details</div>
          <div className="mb-2 text-[15px] font-bold text-slate-900">{po.office}</div>
          <div className="space-y-1">
            <DetailLine>Address: {office?.address ?? po.deliveryAddress}</DetailLine>
            <DetailLine>State: {po.deliveryState}</DetailLine>
            <DetailLine>Country: India</DetailLine>
            <DetailLine>GSTIN: {entity?.gstin ?? '—'}</DetailLine>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 text-[13px] font-bold text-slate-400">Owner Details</div>
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <div>
              <div className="text-[11.5px] text-slate-400">Invoice Owner</div>
              <div className="mt-0.5 text-[13px] font-semibold text-indigo-brand">{po.owner}</div>
            </div>
            <button className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500" title="Edit">
              <Pencil size={13} />
            </button>
          </div>
          <div className="flex items-center justify-between pt-3">
            <div>
              <div className="text-[11.5px] text-slate-400">GRN Owner</div>
              <div className={`mt-0.5 text-[13px] font-semibold ${grnOwner ? 'text-indigo-brand' : 'text-slate-300'}`}>{grnOwner ?? 'Not assigned'}</div>
            </div>
            <button className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500" title="Edit">
              <Pencil size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
