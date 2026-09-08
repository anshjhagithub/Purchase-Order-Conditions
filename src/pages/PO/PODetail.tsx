import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, PenLine, PackageCheck } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { StageBanner } from '../../components/po/StageBanner';
import { RightPanel } from '../../components/po/RightPanel';
import { OverviewTab } from './tabs/OverviewTab';
import { LineItemsTab } from './tabs/LineItemsTab';
import { GRNTab } from './tabs/GRNTab';
import { InvoiceTab } from './tabs/InvoiceTab';
import { RequesterInputTab } from './tabs/RequesterInputTab';
import { AdvancesTab } from './tabs/AdvancesTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { TermsTab } from './tabs/TermsTab';

const TABS = ['Overview', 'Line Items', 'GRN', 'Invoice', 'Requester Input Form', 'Advances', 'Documents', 'Terms'] as const;
type Tab = (typeof TABS)[number];

// The nav bar doubles as a scrollspy: sections stack in one continuous page, and
// the sticky bar's active highlight tracks whichever section is currently under it.
function PoSection({ title, sectionRef, children }: { title?: string; sectionRef: (el: HTMLDivElement | null) => void; children: ReactNode }) {
  return (
    <div ref={sectionRef} className="scroll-mt-28 border-t border-slate-100 pt-10 first:border-t-0 first:pt-0">
      {title && <div className="mb-4 text-[18px] font-bold text-slate-900">{title}</div>}
      {children}
    </div>
  );
}

export function PODetail() {
  const { id } = useParams();
  const { purchaseOrders } = useData();
  const po = purchaseOrders.find((p) => p.id === id);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const sectionRefs = useRef<Partial<Record<Tab, HTMLDivElement>>>({});

  useEffect(() => {
    if (!po) return;
    // The last section (Terms) is short enough that it never reaches the narrow top
    // band the observer watches before the page hits max scroll — the bottom-of-page
    // rule below owns activeTab once that happens, and the observer defers to it so
    // the two don't fight over which one wins on the same scroll event.
    let isNearBottom = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isNearBottom) return;
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const match = (Object.entries(sectionRefs.current) as [Tab, HTMLDivElement][]).find(([, el]) => el === topMost.target);
        if (match) setActiveTab(match[0]);
      },
      // Narrow band just under the sticky nav — whichever section's heading has most
      // recently scrolled past it is the one considered "current".
      { rootMargin: '-120px 0px -65% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));

    // Scroll events target the actual scrolling element (Shell's inner div, not the
    // window), so listen in the capture phase to catch them from window.
    const handleScroll = (e: Event) => {
      const el = e.target as HTMLElement;
      if (!el || typeof el.scrollTop !== 'number') return;
      isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      if (isNearBottom) setActiveTab(TABS[TABS.length - 1]);
    };
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll, true);
    };
    // Depend on po.id, not po itself — a field edit (e.g. recording a GRN) produces a new
    // po object every render, and re-creating the observer on each one is unnecessary churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po?.id]);

  if (!po) {
    return (
      <div className="p-8">
        <Link to="/" className="text-indigo-brand">
          ← Back to Purchase Orders
        </Link>
      </div>
    );
  }

  const isGrnStage = po.stage === 'Goods Receipt Pending' || po.stageIndex >= 4;

  const scrollToTab = (t: Tab) => {
    setActiveTab(t);
    sectionRefs.current[t]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const setSectionRef = (t: Tab) => (el: HTMLDivElement | null) => {
    if (el) sectionRefs.current[t] = el;
    else delete sectionRefs.current[t];
  };

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-7">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50">
            <ArrowLeft size={17} />
          </Link>
          <h1 className="text-[24px] font-bold text-slate-900">{po.poNumber}</h1>
        </div>
        <button className="rounded-lg bg-emerald-100 px-4 py-2 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-200">Move Next →</button>
      </div>

      <div className="mb-5">
        {isGrnStage ? (
          <StageBanner
            icon="📦"
            title={po.stage}
            stageIndex={po.stageIndex}
            ownerIcon={<PackageCheck size={13} />}
            ownerLabel={po.vendorName}
            ownerChip="Supplier"
            actionIcon="💡"
            actionText="Receive goods from vendor"
            percent={po.stagePercent}
            theme="mint"
            live
          />
        ) : (
          <StageBanner
            icon={<PenLine size={16} />}
            title={`Purchase Order ${po.stage}`}
            stageIndex={po.stageIndex}
            ownerIcon="👤"
            ownerLabel="Procurement Team"
            ownerChip="Admin"
            actionIcon="💡"
            actionText="Generate and send PO to vendor"
            percent={po.stagePercent}
            theme="cream"
          />
        )}
      </div>

      <div className="sticky top-0 z-20 -mx-8 mb-5 bg-[#f4f5f9] px-8 pt-1">
        <div className="flex gap-6 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => scrollToTab(t)}
              className={`relative pb-3 text-[13.5px] font-semibold transition ${activeTab === t ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {t}
              {activeTab === t && <span className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full bg-slate-900" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-10">
          <PoSection title="Overview" sectionRef={setSectionRef('Overview')}>
            <OverviewTab po={po} />
          </PoSection>
          <PoSection sectionRef={setSectionRef('Line Items')}>
            <LineItemsTab po={po} />
          </PoSection>
          <PoSection sectionRef={setSectionRef('GRN')}>
            <GRNTab po={po} />
          </PoSection>
          <PoSection sectionRef={setSectionRef('Invoice')}>
            <InvoiceTab po={po} />
          </PoSection>
          <PoSection title="Requester Input Form" sectionRef={setSectionRef('Requester Input Form')}>
            <RequesterInputTab po={po} />
          </PoSection>
          <PoSection title="Advances" sectionRef={setSectionRef('Advances')}>
            <AdvancesTab />
          </PoSection>
          <PoSection sectionRef={setSectionRef('Documents')}>
            <DocumentsTab po={po} />
          </PoSection>
          <PoSection title="Terms & Conditions" sectionRef={setSectionRef('Terms')}>
            <TermsTab po={po} />
          </PoSection>
        </div>
        <div className="sticky top-[76px] self-start">
          <RightPanel po={po} />
        </div>
      </div>
    </div>
  );
}
