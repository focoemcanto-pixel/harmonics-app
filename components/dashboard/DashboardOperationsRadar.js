'use client';

import Link from 'next/link';
import AdminSectionTitle from '../admin/AdminSectionTitle';

const items = [
  {
    key: 'contratosPendentes',
    title: 'Contratos pendentes',
    helper: 'Fluxos contratuais ainda não concluídos.',
    tone:
      'border-violet-200 bg-violet-50 text-violet-800',
    href: '/eventos',
  },
  {
    key: 'pagamentosPendentes',
    title: 'Pagamentos pendentes',
    helper: 'Eventos com saldo em aberto no financeiro.',
    tone:
      'border-amber-200 bg-amber-50 text-amber-800',
    href: '/eventos',
  },
  {
    key: 'repertoriosAguardandoAcao',
    title: 'Repertórios aguardando ação',
    helper: 'Repertórios ainda não finalizados ou reabertos.',
    tone:
      'border-sky-200 bg-sky-50 text-sky-800',
    href: '/repertorios',
  },
  {
    key: 'escalasIncompletas',
    title: 'Escalas incompletas',
    helper: 'Escalas com pendência ou recusa de músico.',
    tone:
      'border-rose-200 bg-rose-50 text-rose-800',
    href: '/escalas',
  },
];

export default function DashboardOperationsRadar({ summary }) {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
      <AdminSectionTitle
        title="Atenção agora"
        subtitle="Radar operacional com pendências reais que exigem ação rápida."
      />

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => {
          const value = Number(summary?.[item.key] || 0);

          return (
            <div
              key={item.key}
              className={`rounded-[22px] border px-4 py-4 shadow-[0_6px_18px_rgba(17,24,39,0.03)] ${item.tone}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[13px] font-black uppercase tracking-[0.06em] opacity-80">
                    {item.title}
                  </div>

                  <div className="mt-3 text-[30px] font-black leading-none">
                    {value}
                  </div>

                  <div className="mt-3 text-[13px] font-semibold leading-5 opacity-80">
                    {item.helper}
                  </div>
                </div>

                <Link
                  href={item.href}
                  className="shrink-0 rounded-[16px] bg-white/80 px-3 py-2 text-[12px] font-black text-[#0f172a] transition hover:bg-white"
                >
                  Ver
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
