export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  className = '',
  disabled = false,
}) {
  const variants = {
    primary:
      'bg-violet-600 text-white hover:bg-violet-700',
    secondary:
      'bg-slate-900 text-white hover:bg-slate-800',
    soft:
      'bg-slate-100 text-slate-800 hover:bg-slate-200',
    danger:
      'bg-red-500 text-white hover:bg-red-600',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700',
    ghost:
      'bg-transparent text-slate-700 hover:bg-slate-100',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}