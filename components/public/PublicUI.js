import Link from 'next/link';

// Base visual das superfícies públicas (landing, planos, cadastro, login, onboarding):
// fundo escuro com brilho violeta/fúcsia, a mesma identidade do login e do painel.

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-purple-700 px-6 py-4 text-sm font-black text-white shadow-[0_18px_42px_rgba(124,58,237,0.38)] transition hover:from-violet-500 hover:via-fuchsia-500 hover:to-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-60';

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-4 text-sm font-black text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-60';

export const inputClass =
  'w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3.5 text-sm text-white placeholder:text-slate-500 transition focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60';

export const labelClass = 'mb-2 block text-sm font-semibold text-slate-200';

export const panelClass =
  'rounded-[28px] border border-white/12 bg-white/[0.06] shadow-[0_35px_120px_rgba(2,6,23,0.55)] backdrop-blur-xl';

export function PublicBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-violet-700/25 blur-3xl" />
      <div className="absolute right-[-8rem] top-[28rem] h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/15 blur-3xl" />
      <div className="absolute left-[-8rem] top-[60rem] h-[24rem] w-[24rem] rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_38%)]" />
    </div>
  );
}

export function BrandMark({ href = '/', compact = false, compactOnMobile = false }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300" aria-label="Harmonics — página inicial">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl border border-white/15 shadow-lg shadow-violet-900/40" />
      {compact ? null : <span className={`text-lg font-black tracking-[-0.03em] text-white ${compactOnMobile ? 'hidden min-[420px]:inline' : ''}`}>Harmonics</span>}
    </Link>
  );
}

const NAV_ITEMS = [
  { key: 'produto', href: '/#produto', label: 'Produto' },
  { key: 'como-funciona', href: '/#como-funciona', label: 'Como funciona' },
  { key: 'recursos', href: '/#recursos', label: 'Recursos' },
  { key: 'planos', href: '/planos', label: 'Planos' },
];

export function PublicHeader({ active = '' }) {
  const linkClass = (key) =>
    `rounded-xl px-3 py-2 text-sm font-semibold transition ${active === key ? 'text-white' : 'text-slate-300 hover:text-white'}`;
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 md:px-6">
      <BrandMark compactOnMobile />
      <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => (
          <Link key={item.key} href={item.href} className={linkClass(item.key)}>{item.label}</Link>
        ))}
      </nav>
      <div className="flex items-center gap-1 sm:gap-2">
        <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition hover:text-white">Entrar</Link>
        <Link href="/signup" className="rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-violet-100">
          Começar grátis
        </Link>
        <details className="group relative lg:hidden">
          <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-white/15 text-slate-200 [&::-webkit-details-marker]:hidden" aria-label="Abrir menu">
            <span aria-hidden="true" className="text-lg leading-none group-open:hidden">☰</span>
            <span aria-hidden="true" className="hidden text-lg leading-none group-open:inline">✕</span>
          </summary>
          <nav className="absolute right-0 top-11 w-52 rounded-2xl border border-white/12 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl" aria-label="Navegação principal (menu)">
            {NAV_ITEMS.map((item) => (
              <Link key={item.key} href={item.href} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10">{item.label}</Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}

// Indicador da jornada do novo cliente: conta → espaço → assinatura (plano pago) ou painel (Free).
export function JourneySteps({ current = 'account', paidPlanName = '' }) {
  const steps = [
    { key: 'account', label: 'Sua conta' },
    { key: 'workspace', label: 'Seu espaço' },
    paidPlanName ? { key: 'billing', label: `Assinatura ${paidPlanName}` } : { key: 'panel', label: 'Painel' },
  ];
  const currentIndex = Math.max(0, steps.findIndex((step) => step.key === current));
  return (
    <ol className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold" aria-label="Etapas do cadastro">
      {steps.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'next';
        return (
          <li key={step.key} className="flex min-w-0 items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                state === 'done'
                  ? 'bg-emerald-400 text-slate-950'
                  : state === 'current'
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white'
                    : 'border border-white/20 text-slate-400'
              }`}
            >
              {state === 'done' ? '✓' : index + 1}
            </span>
            <span className={`truncate ${state === 'current' ? '' : 'hidden sm:inline'} ${state === 'next' ? 'text-slate-500' : 'text-slate-200'}`}>{step.label}</span>
            {index < steps.length - 1 ? <span className="h-px w-4 shrink-0 bg-white/15 sm:w-8" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function Alert({ tone = 'error', children }) {
  const tones = {
    error: 'border-red-400/35 bg-red-500/10 text-red-100',
    success: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100',
    info: 'border-violet-300/30 bg-violet-500/10 text-violet-100',
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 ${tones[tone] || tones.error}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Spinner({ className = '' }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white ${className}`} aria-hidden="true" />;
}

export function PublicLoading({ label }) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-950 px-6 text-white">
      <PublicBackground />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <BrandMark compact />
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-slate-200">
          <Spinner />
          {label}
        </div>
      </div>
    </main>
  );
}
