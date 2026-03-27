'use client';

import Link from 'next/link';

function navClass(active) {
  return active
    ? 'bg-violet-100 text-violet-700 shadow-[0_10px_24px_rgba(124,58,237,0.08)]'
    : 'text-[#c7d2fe] hover:bg-white/5 hover:text-white';
}

export default function AdminSidebar({ activeItem = 'eventos' }) {
  const items = [
    { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
    { key: 'eventos', label: 'Eventos', href: '/eventos' },
    { key: 'contatos', label: 'Contatos', href: '/contatos' },
    { key: 'convites', label: 'Convites', href: '/convites' },
    { key: 'escalas', label: 'Escalas', href: '/escalas' },
    { key: 'contratos', label: 'Contratos', href: '/contratos' },
    { key: 'repertorios', label: 'Repertórios', href: '/repertorios' },
    { key: 'pagamentos', label: 'Pagamentos', href: '/pagamentos' },
  ];

  return (
    <aside className="sticky top-0 flex min-h-screen w-[280px] shrink-0 flex-col bg-[#020b2c] px-5 py-6 text-white">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-xl font-black">
          H
        </div>
        <div>
          <div className="text-[15px] font-black">Harmonics</div>
          <div className="text-[12px] text-[#a5b4fc]">Admin</div>
        </div>
      </div>

      <nav className="mt-8 space-y-2">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-[15px] font-bold transition ${navClass(
              activeItem === item.key
            )}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto px-2 pt-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#a5b4fc]">
            Harmonics SaaS
          </div>
          <div className="mt-2 text-[14px] font-bold text-white">
            Painel administrativo híbrido
          </div>
        </div>
      </div>
    </aside>
  );
}