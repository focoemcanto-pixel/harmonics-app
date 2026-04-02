'use client';

import Link from 'next/link';

function getCurrentMonthLabel() {
  const now = new Date();

  return now.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

export default function DashboardHero() {
  const currentMonthLabel = getCurrentMonthLabel();

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#dbe3ef] bg-[linear-gradient(135deg,#ffffff_0%,#f8faff_45%,#f4f1ff_100%)] p-5 shadow-[0_18px_50px_rgba(17,24,39,0.07)] md:p-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_24%)]" />

      <div className="relative z-10">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-violet-700 md:text-[11px]">
              Harmonics Admin
            </div>

            <h1 className="mt-3 text-[28px] font-black tracking-[-0.05em] text-[#0f172a] md:mt-4 md:text-[42px]">
              Dashboard executivo
            </h1>

            <p className="mt-3 max-w-2xl text-[14px] leading-6 text-[#64748b] md:text-[16px] md:leading-7">
              Acompanhe a saúde financeira e operacional da Harmonics com uma
              leitura rápida, premium e orientada para ação.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-white/70 bg-white/80 px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur">
                <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                  Período atual
                </div>
                <div className="mt-2 text-[16px] font-black capitalize text-[#0f172a]">
                  {currentMonthLabel}
                </div>
              </div>

              <div className="rounded-[18px] border border-white/70 bg-white/80 px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur">
                <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                  Foco da leitura
                </div>
                <div className="mt-2 text-[16px] font-black text-[#0f172a]">
                  Financeiro + operação
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap xl:max-w-[360px] xl:justify-end">
            <Link
              href="/eventos"
              className="inline-flex items-center justify-center rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[14px] font-black text-[#0f172a] shadow-[0_10px_24px_rgba(17,24,39,0.04)] transition hover:bg-[#f8fafc]"
            >
              Ver operação
            </Link>

            <Link
              href="/eventos/novo"
              className="inline-flex items-center justify-center rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_14px_32px_rgba(124,58,237,0.24)] transition hover:bg-violet-700"
            >
              Novo evento
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
