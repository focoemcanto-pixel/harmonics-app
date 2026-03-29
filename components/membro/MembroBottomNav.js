'use client';

const ITEMS = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'solicitacoes', label: 'Solicitações', icon: '🔔' },
  { key: 'agenda', label: 'Agenda', icon: '📅' },
  { key: 'repertorios', label: 'Repertórios', icon: '🎼' },
  { key: 'perfil', label: 'Perfil', icon: '👤' },
];

export default function MembroBottomNav({ activeTab, onChange }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[120] border-t border-white/10 bg-[rgba(8,10,22,0.94)] px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-2">
        {ITEMS.map((item) => {
          const active = activeTab === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`flex flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-3 text-center transition ${
                active
                  ? 'bg-violet-500/18 text-violet-100'
                  : 'bg-transparent text-white/45'
              }`}
            >
              <span className="text-[18px] leading-none">{item.icon}</span>
              <span className="text-[10px] font-black tracking-[0.02em]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
