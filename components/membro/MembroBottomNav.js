'use client';

const ITEMS = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'pendentes', label: 'Solicitações', icon: '🔔' },
  { key: 'escalas', label: 'Agenda', icon: '📅' },
  { key: 'repertorios', label: 'Repertórios', icon: '🎼' },
  { key: 'perfil', label: 'Perfil', icon: '👤' },
];

export default function MembroBottomNav({ active, onChange, pendingCount = 0 }) {
  return (
    <nav
      aria-label="Navegação do painel do membro"
      className="fixed bottom-0 left-0 right-0 z-[120] border-t border-white/10 bg-[rgba(5,10,26,0.94)] px-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2 backdrop-blur-2xl md:hidden"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1.5">
        {ITEMS.map((item) => {
          const isActive = active === item.key;

          return (
            <button
              key={item.key}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onChange?.(item.key)}
              className={`relative flex min-h-[64px] touch-manipulation flex-col items-center justify-center rounded-[18px] px-1.5 py-2 text-center transition-all duration-200 active:scale-[0.98] ${
                isActive
                  ? 'bg-[linear-gradient(135deg,rgba(167,85,255,0.98),rgba(217,70,239,0.98))] text-white shadow-[0_16px_30px_rgba(168,85,247,0.32)]'
                  : 'bg-transparent text-white/58'
              }`}
            >
              <span className={`text-[18px] leading-none ${isActive ? '' : 'opacity-90'}`}>
                {item.icon}
              </span>

              <span
                className={`mt-1 max-w-full truncate text-[9.5px] font-black leading-4 sm:text-[10px] ${
                  isActive ? 'text-white' : 'text-white/62'
                }`}
              >
                {item.label}
              </span>

              {item.key === 'pendentes' && pendingCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-[0_6px_16px_rgba(239,68,68,0.35)]">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
