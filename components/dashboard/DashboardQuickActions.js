'use client';

import Link from 'next/link';
import AdminSectionTitle from '../admin/AdminSectionTitle';

const actions = [
  { label: 'Novo evento', href: '/eventos' },
  { label: 'Pré-contratos', href: '/pre-contratos' },
  { label: 'Contratos', href: '/contratos' },
  { label: 'Contatos', href: '/contatos' },
  { label: 'Escalas', href: '/escalas' },
  { label: 'Repertórios', href: '/repertorios' },
];

export default function DashboardQuickActions() {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
      <AdminSectionTitle
        title="Ações rápidas"
        subtitle="Atalhos para os fluxos mais usados no dia a dia."
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="rounded-[20px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-5 text-[14px] font-black text-[#0f172a] transition hover:bg-[#eef2ff]"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
