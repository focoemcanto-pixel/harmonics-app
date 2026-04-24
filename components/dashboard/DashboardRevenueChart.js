'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';
import { buildMonthlyFinancialSeries } from '@/lib/finance/calculateFinancialSummary';

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function MobileMetricCard({ label, value, helper, tone = 'default' }) {
  const tones = {
    default: 'border-slate-200 bg-white text-[#0f172a]',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  };

  return (
    <div className={`rounded-[20px] border px-4 py-4 shadow-[0_8px_20px_rgba(17,24,39,0.03)] ${tones[tone] || tones.default}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </div>
      <div className="mt-2 text-[22px] font-black tracking-[-0.04em]">
        {value}
      </div>
      <div className="mt-2 text-[13px] font-semibold leading-5 text-[#64748b]">
        {helper}
      </div>
    </div>
  );
}

export default function DashboardRevenueChart({ events = [] }) {
  const series = buildMonthlyFinancialSeries(events, 6);

  const maxValue = Math.max(
    1,
    ...series.flatMap((item) => [item.receitaContratada, item.lucroPrevisto])
  );

  const totalReceitaContratada = series.reduce((acc, item) => acc + item.receitaContratada, 0);
  const totalLucroPrevisto = series.reduce((acc, item) => acc + item.lucroPrevisto, 0);

  const melhorMes = [...series].sort((a, b) => b.receitaContratada - a.receitaContratada)[0];

  return (
    <section className="rounded-[30px] border border-[#dbe3ef] bg-[linear-gradient(180deg,#ffffff_0%,#fcfdff_100%)] p-5 shadow-[0_16px_40px_rgba(17,24,39,0.06)] md:p-6">
      <AdminSectionTitle
        title="Evolução financeira"
        subtitle="Leitura dos últimos 6 meses, acompanhando receita contratada e lucro previsto."
      />

      <div className="mt-4 rounded-[24px] border border-[#eef2f7] bg-[linear-gradient(180deg,#fcfdff_0%,#f8fafc_100%)] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MobileMetricCard
            label="Receita contratada acumulada"
            value={formatMoney(totalReceitaContratada)}
            helper="Soma do valor negociado nos últimos meses exibidos."
            tone="violet"
          />

          <MobileMetricCard
            label="Lucro previsto acumulado"
            value={formatMoney(totalLucroPrevisto)}
            helper="Margem final prevista após os custos da operação."
            tone="emerald"
          />
        </div>

        <div className="mt-4 md:hidden">
          <div className="rounded-[20px] border border-[#eef2f7] bg-white/90 px-4 py-4 shadow-[0_8px_20px_rgba(17,24,39,0.03)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                  Melhor mês em receita contratada
                </div>
                <div className="mt-2 text-[20px] font-black tracking-[-0.03em] text-[#0f172a] uppercase">
                  {melhorMes?.label || '--'}
                </div>
              </div>

              <div className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">
                {formatMoney(melhorMes?.receitaContratada || 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-[12px] font-black text-[#475569]">
            <span className="inline-block h-3 w-3 rounded-full bg-violet-500" />
            Receita contratada
          </div>

          <div className="flex items-center gap-2 text-[12px] font-black text-[#475569]">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
            Lucro previsto
          </div>
        </div>

        <div className="mt-5 md:hidden">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {series.map((item) => {
              const brutoHeight = Math.max(
                16,
                Math.round((item.receitaContratada / maxValue) * 120)
              );
              const liquidoHeight = Math.max(
                16,
                Math.round((item.lucroPrevisto / maxValue) * 120)
              );

              return (
                <div
                  key={item.key}
                  className="w-[132px] shrink-0 rounded-[20px] border border-[#eef2f7] bg-white/90 px-4 py-4 shadow-[0_8px_20px_rgba(17,24,39,0.03)]"
                >
                  <div className="flex h-[136px] items-end justify-center gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-5 rounded-t-[12px] bg-violet-500 shadow-[0_10px_22px_rgba(124,58,237,0.24)]"
                        style={{ height: `${brutoHeight}px` }}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <div
                        className="w-5 rounded-t-[12px] bg-emerald-500 shadow-[0_10px_22px_rgba(16,185,129,0.20)]"
                        style={{ height: `${liquidoHeight}px` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                      {item.label}
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="text-[11px] font-semibold text-violet-700">
                        {formatMoney(item.receitaContratada)}
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-700">
                        {formatMoney(item.lucroPrevisto)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 hidden overflow-x-auto md:block">
          <div className="flex min-w-[560px] items-end gap-4">
            {series.map((item) => {
              const brutoHeight = Math.max(
                10,
                Math.round((item.receitaContratada / maxValue) * 190)
              );
              const liquidoHeight = Math.max(
                10,
                Math.round((item.lucroPrevisto / maxValue) * 190)
              );

              return (
                <div key={item.key} className="flex flex-1 flex-col items-center">
                  <div className="flex h-[228px] items-end gap-2">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-5 rounded-t-[12px] bg-violet-500 shadow-[0_10px_22px_rgba(124,58,237,0.24)]"
                        style={{ height: `${brutoHeight}px` }}
                        title={`Receita contratada: ${formatMoney(item.receitaContratada)}`}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <div
                        className="w-5 rounded-t-[12px] bg-emerald-500 shadow-[0_10px_22px_rgba(16,185,129,0.20)]"
                        style={{ height: `${liquidoHeight}px` }}
                        title={`Lucro previsto: ${formatMoney(item.lucroPrevisto)}`}
                      />
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                      {item.label}
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="text-[11px] font-semibold text-violet-700">
                        {formatMoney(item.receitaContratada)}
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-700">
                        {formatMoney(item.lucroPrevisto)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
