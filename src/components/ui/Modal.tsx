import React from 'react';
import { X } from 'lucide-react';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  width = 640,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-[1px] py-8">
      <div
        className="relative flex max-h-[92vh] w-full flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-8 pb-5 pt-7">
          <div>
            <h2 className="text-[26px] font-bold leading-tight text-slate-900">{title}</h2>
            {subtitle && <p className="mt-1.5 max-w-md text-[13.5px] leading-snug text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">{children}</div>
        {footer && <div className="border-t border-slate-100 px-8 py-5">{footer}</div>}
      </div>
    </div>
  );
}
