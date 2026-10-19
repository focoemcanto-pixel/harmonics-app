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
      'bg-violet-600 text-white hover:bg-violet-700 shadow-[0_1px_2px_rgba(16,24,40,0.08)]',
    secondary:
      'bg-[#0c0d12] text-white hover:bg-black',
    soft:
      'border border-[#e4e7ec] bg-white text-slate-800 hover:bg-[#f6f7f9]',
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
      className={`inline-flex min-h-11 touch-manipulation items-center justify-center rounded-full px-5 py-2.5 text-center text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
