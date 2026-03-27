'use client';

import Link from 'next/link';

const itens = [
  { label: 'Dashboard', href: '/' },
  { label: 'Eventos', href: '/eventos' },
  { label: 'Contatos', href: '/contatos' },
  { label: 'Convites', href: '/convites' },
  { label: 'Escalas', href: '/escalas' },
  { label: 'Contratos', href: '/contratos' },
  { label: 'Repertórios', href: '/repertorios' },
  { label: 'Pagamentos', href: '/pagamentos' },
];

export default function Sidebar() {
  return (
    <aside className="w-72 min-h-screen bg-slate-950 text-white p-5">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-lg font-bold">
          H
        </div>
        <div>
          <h1 className="text-2xl font-bold">Harmonics</h1>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {itens.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl px-4 py-3 text-slate-200 transition hover:bg-white/10"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}