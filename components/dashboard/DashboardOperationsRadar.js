'use client';

import Link from 'next/link';
import AdminSectionTitle from '../admin/AdminSectionTitle';

const items = [
  {
    key: 'contratosPendentes',
    title: 'Contratos pendentes',
    helper: 'Fluxos contratuais ainda não concluídos e que exigem avanço operacional.',
    tone:
      'border-violet-200 bg-[linear-gradient(180deg,#faf7ff_0%,#f5f3ff_100%)] text-violet-800',
    badgeTone: 'bg-violet-600 text-white',
    href: '/eventos',
  },
  {
    key: 'pagamentosPendentes',
    title: 'Pagamentos pendentes',
    helper: 'Eventos com saldo em aberto e risco de pressão no caixa do período.',
    tone:
      'border-amber-200 bg-[linear-gradient(180deg,#fffaf0_0%,#fffbeb_100%)] text-amber-800',
    badgeTone: 'bg-amber-500 text-white',
    href: '/eventos',
  },
  {
    key: 'repertoriosAguardandoAcao',
    title: 'Repertórios aguardando ação',
    helper: 'Repertórios não finalizados, reabertos ou ainda sem fechamento do cliente.',
    tone:
      'border-sky-200 bg-[linear-gradient(180deg,#f3fbff_0%,#eff6ff_100%)] text-sky-800',
    badgeTone: 'bg-sky-500 text-white',
    href: '/repertorios',
  },
  {
    key: 'escalasIncompletas',
    title: 'Escalas incompletas',
    helper: 'Escalas com pendência ou recusa de músico, exigindo nova ação do admin.',
    tone:
      'border-rose-200 bg-[linear-gradient(180deg,#fff5f6_0%,#fff1f2_100%)] text-rose-800',
    badgeTone: 'bg-rose-500 text-white',
    href: '/escalas',
  },
];

export default function DashboardOperationsRadar({ summary }) {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_32px_rgba(17,24,39,0.05)]">
      <AdminSectionTitle
        title="Atenção agora"
        subtitle="Radar operacional com pendências reais que merecem leitura e ação imediata."
      />

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((item) => {
          const value = Number(summary?.[item.key] || 0);
          const isZero = value === 0;

          return (
            <div
              key={item.key}
              className={`relative overflow-hidden rounded-[24px] border px-5 py-5 shadow-[0_10px_24px_rgba(17,24,39,0.04)] ${item.tone}`}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.45),transparent_34%)]" />

              <div className="relative z-10 flex h-full flex-col justify-between gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[12px] font-black uppercase tracking-[0.1em] opacity-80">
                      {item.title}
                    </div>

                    <div className="mt-4 text-[34px] font-black leading-none tracking-[-0.04em]">
                      {value}
                    </div>

                    <div className="mt-4 max-w-[26rem] text-[13px] font-semibold leading-5 opacity-80">
                      {item.helper}
                    </div>
                  </div>

                  <div
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${isZero ? 'bg-white/80 text-[#0f172a]' : item.badgeTone}`}
                  >
                    {isZero ? 'Ok' : 'Ação'}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-black uppercase tracking-[0.08em] text-[#475569]">
                    {isZero ? 'Sem pendências agora' : 'Requer acompanhamento'}
                  </div>

                  <Link
                    href={item.href}
                    className="rounded-[16px] bg-white/85 px-4 py-2.5 text-[12px] font-black text-[#0f172a] shadow-[0_8px_18px_rgba(17,24,39,0.05)] transition hover:bg-white"
                  >
                    Ver detalhes
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
