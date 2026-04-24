'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function percentOf(value, total) {
  if (!total || total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function BreakdownCard({ item, receitaContratada, maxValue }) {
  const width = Math.max(8, Math.round((item.value / maxValue) * 100));
  const percentage = percentOf(item.value, receitaContratada);

  return (
    <div
      className={`rounded-[20px] border bg-white/90 px-4 py-4 shadow-[0_8px_20px_rgba(17,24,39,0.03)] ${item.border}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            {item.label}
          </div>
          <div className={`mt-2 text-[20px] font-black tracking-[-0.03em] ${item.text}`}>
            {formatMoney(item.value)}
          </div>
        </div>

        <div className="shrink-0 rounded-full bg-[#f1f5f9] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#475569]">
          {percentage}%
        </div>
      </div>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[#eef2f7]">
        <div
          className={`h-full rounded-full ${item.tone}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardFinanceBreakdown({ summary }) {
  const receitaContratada = summary?.receitaContratada || 0;
  const recebido = summary?.recebido || 0;
  const emAberto = summary?.emAberto || 0;
  const custosTotais = summary?.custosTotais || 0;
  const lucroPrevisto = summary?.lucroPrevisto || 0;

  const rows = [
    {
      key: 'receitaContratada',
      label: 'Receita contratada',
      value: receitaContratada,
      tone: 'bg-blue-500',
      text: 'text-blue-700',
      border: 'border-blue-100',
    },
    {
      key: 'recebido',
      label: 'Recebido',
      value: recebido,
      tone: 'bg-emerald-500',
      text: 'text-emerald-700',
      border: 'border-emerald-100',
    },
    {
      key: 'emAberto',
      label: 'Em aberto',
      value: emAberto,
      tone: 'bg-amber-500',
      text: 'text-amber-800',
      border: 'border-amber-100',
    },
    {
      key: 'custosTotais',
      label: 'Custos totais',
      value: custosTotais,
      tone: 'bg-slate-500',
      text: 'text-slate-700',
      border: 'border-slate-200',
    },
    {
      key: 'lucroPrevisto',
      label: 'Lucro previsto',
      value: lucroPrevisto,
      tone: 'bg-violet-500',
      text: 'text-violet-700',
      border: 'border-violet-100',
    },
  ];

  const maxValue = Math.max(1, ...rows.map((item) => item.value));

  return (
    <section className="rounded-[30px] border border-[#dbe3ef] bg-[linear-gradient(180deg,#ffffff_0%,#fcfdff_100%)] p-5 shadow-[0_16px_40px_rgba(17,24,39,0.06)] md:p-6">
      <AdminSectionTitle
        title="Composição financeira"
        subtitle="Resumo do mês atual com foco em receita contratada, recebido, pendências, custos e lucro previsto."
      />

      <div className="mt-4 rounded-[24px] border border-[#eef2f7] bg-[linear-gradient(180deg,#fcfdff_0%,#f8fafc_100%)] p-4">
        <div className="mt-5 flex gap-3 overflow-x-auto pb-2 md:hidden">
          {rows.map((item) => (
            <div key={item.key} className="w-[86%] shrink-0">
              <BreakdownCard item={item} receitaContratada={receitaContratada} maxValue={maxValue} />
            </div>
          ))}
        </div>

        <div className="mt-5 hidden space-y-4 md:block">
          {rows.map((item) => (
            <BreakdownCard
              key={item.key}
              item={item}
              receitaContratada={receitaContratada}
              maxValue={maxValue}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
