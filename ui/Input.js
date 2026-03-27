export default function Input({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  className = '',
  min,
  max,
}) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-2 block text-sm font-medium text-slate-600">
          {label}
        </span>
      )}

      <input
        type={type}
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
      />
    </label>
  );
}