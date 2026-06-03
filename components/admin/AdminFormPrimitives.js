'use client';

import { forwardRef } from 'react';

export function Field({ label, children, helper }) {
  return (
    <div className="min-w-0 space-y-2">
      <label className="block text-[12px] font-bold text-[#64748b]">{label}</label>
      {children}
      {helper && <p className="break-words text-[11px] text-[#94a3b8]">{helper}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { value, onChange, placeholder = '', type = 'text', disabled = false, helpText: _helpText, step, ...props },
  ref,
) {
  void _helpText;

  return (
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      step={step}
      {...props}
      className="min-h-12 w-full touch-manipulation rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3.5 text-[16px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
});

export function Select({ value, onChange, children, disabled = false, ...props }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      {...props}
      className="min-h-12 w-full touch-manipulation rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3.5 text-[16px] font-semibold text-[#0f172a] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-400"
    >
      {children}
    </select>
  );
}

export function Textarea({ value, onChange, placeholder = '', rows = 3, disabled = false }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="min-h-[120px] w-full touch-manipulation resize-y rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3.5 text-[16px] font-semibold leading-6 text-[#0f172a] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
}

export function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 rounded-[14px] px-1 py-2 active:scale-[0.99]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 rounded border-[#dbe3ef] text-violet-600 focus:ring-2 focus:ring-violet-100"
      />
      <span className="min-w-0 break-words text-[14px] font-semibold text-[#0f172a]">{label}</span>
    </label>
  );
}
