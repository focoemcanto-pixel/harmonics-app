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

export function Input({ value, onChange, placeholder = '', type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
    />
  );
}

export function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
    >
      {children}
    </select>
  );
}

export function Textarea({ value, onChange, placeholder = '', rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
    />
  );
}
