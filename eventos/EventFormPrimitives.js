'use client';

export function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <label className="text-[12px] font-bold text-[#64748b]">{label}</label>
      {children}
    </div>
  );
}

export function Input({ value, onChange, type = 'text', placeholder = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none"
    />
  );
}

export function Select({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none"
    >
      {children}
    </select>
  );
}