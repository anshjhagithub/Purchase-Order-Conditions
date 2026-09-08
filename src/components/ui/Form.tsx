import React, { useState } from 'react';
import { Switch } from '@headlessui/react';
import { ChevronDown, Info } from 'lucide-react';

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="field-label">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1 flex items-start gap-1 text-[11.5px] leading-snug text-slate-400">
          <Info size={12} className="mt-0.5 shrink-0" />
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field-input ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`field-input resize-none ${props.className ?? ''}`} />;
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="field-input appearance-none pr-9"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="group relative flex h-6 w-11 shrink-0 rounded-full bg-slate-300 transition data-[checked]:bg-indigo-brand data-[disabled]:opacity-40"
    >
      <span
        className="pointer-events-none m-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform group-data-[checked]:translate-x-5"
      />
    </Switch>
  );
}

export function Accordion({ title, subtitle, children, defaultOpen = false }: { title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <div className="text-[14px] font-bold text-slate-800">{title}</div>
          {subtitle && <div className="text-[12px] text-slate-400">{subtitle}</div>}
        </div>
        <ChevronDown size={18} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-slate-100 px-5 py-5">{children}</div>}
    </div>
  );
}

export function MultiChipSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-[#f2f1f8] p-2 min-h-[44px]">
      {options.length === 0 && <span className="px-1.5 py-1 text-[12.5px] text-slate-400">{placeholder ?? 'None available'}</span>}
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            type="button"
            key={o.value}
            onClick={() => toggle(o.value)}
            className={`rounded-md border px-2.5 py-1 text-[12px] font-medium transition ${
              active ? 'border-indigo-brand bg-indigo-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
