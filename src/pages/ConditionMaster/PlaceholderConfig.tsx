
import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

export function PlaceholderConfig() {
  const location = useLocation();
  const label = location.pathname
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/-/g, ' ');

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Construction size={26} />
      </div>
      <div className="text-[17px] font-bold capitalize text-slate-700">{label ?? 'Configuration'}</div>
      <div className="max-w-sm text-[13px] text-slate-400">
        Out of scope for this prototype — only Procure to Pay Configuration → PO Conditions is wired up.
      </div>
    </div>
  );
}
