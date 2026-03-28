'use client';

export function Field({ label, children, helper }) {
  return (
    <div className="space-y-2">
      <label className="text-[12px] font-bold text-[#64748b]">{label}</label>
      {children}
      {helper && <p className="text-[11px] text-[#94a3b8]">{helper}</p>}
    </div>
  );
}

export function Input({ value, onChange, placeholder = '', type = 'text', disabled = false }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
}

export function Select({ value, onChange, children, disabled = false }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-400"
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
      className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
}

export function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 rounded border-[#dbe3ef] text-violet-600 focus:ring-2 focus:ring-violet-100"
      />
      <span className="text-[14px] font-semibold text-[#0f172a]">{label}</span>
    </label>
  );
}
