'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';

function toNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function getMonthRangeEvents(events = []) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  return events.filter((ev) => {
    if (!ev?.event_date) return false;

    const d = new Date(`${ev.event_date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return false;

    return d.getMonth() === month && d.getFullYear() === year;
  });
}

function percentOf(value, total) {
  if (!total || total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function BreakdownCard({ item, bruto, maxValue }) {
  const width = Math.max(8, Math.round((item.value / maxValue) * 100));
  const percentage = percentOf(item.value, bruto);

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

export default function DashboardFinanceBreakdown({ events = [], summary }) {
  const eventosMes = getMonthRangeEvents(events);

  const recebido = summary?.recebido || 0;
  const emAberto = summary?.emAberto || 0;
  const lucro = summary?.liquido || 0;
  const bruto = summary?.bruto || 0;

  const custos = eventosMes.reduce((acc, ev) => {
    return (
      acc +
      toNumber(ev.musician_cost) +
      toNumber(ev.sound_cost) +
      toNumber(ev.extra_transport_cost)
    );
  }, 0);

  const rows = [
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
      key: 'custos',
      label: 'Custos',
      value: custos,
      tone: 'bg-slate-500',
      text: 'text-slate-700',
      border: 'border-slate-200',
    },
    {
      key: 'lucro',
      label: 'Lucro',
      value: lucro,
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
        subtitle="Resumo do mês atual com foco em entrada, pendência, custo e resultado final."
      />

      <div className="mt-4 rounded-[24px] border border-[#eef2f7] bg-[linear-gradient(180deg,#fcfdff_0%,#f8fafc_100%)] p-4">
        <div className="rounded-[20px] border border-[#eef2f7] bg-white/90 px-4 py-4 shadow-[0_8px_20px_rgba(17,24,39,0.03)]">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Base do mês
          </div>
          <div className="mt-2 text-[24px] font-black tracking-[-0.04em] text-[#0f172a] md:text-[26px]">
            {formatMoney(bruto)}
          </div>
          <div className="mt-2 text-[13px] font-semibold leading-5 text-[#64748b]">
            Valor bruto total considerado no período atual.
          </div>
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-2 md:hidden">
          {rows.map((item) => (
            <div key={item.key} className="w-[86%] shrink-0">
              <BreakdownCard item={item} bruto={bruto} maxValue={maxValue} />
            </div>
          ))}
        </div>

        <div className="mt-5 hidden space-y-4 md:block">
          {rows.map((item) => (
            <BreakdownCard
              key={item.key}
              item={item}
              bruto={bruto}
              maxValue={maxValue}
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-[20px] border border-[#eef2f7] bg-white/90 px-4 py-4 shadow-[0_8px_20px_rgba(17,24,39,0.03)]">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Resultado do mês
            </div>
            <div className="mt-2 text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">
              {lucro >= 0 ? 'Operação positiva' : 'Operação negativa'}
            </div>
            <div className="mt-2 text-[13px] font-semibold leading-5 text-[#64748b]">
              Leitura rápida do resultado líquido atual da operação.
            </div>
          </div>

          <div className="rounded-[20px] border border-[#eef2f7] bg-white/90 px-4 py-4 shadow-[0_8px_20px_rgba(17,24,39,0.03)]">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Pressão financeira
            </div>
            <div className="mt-2 text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">
              {emAberto > 0 ? 'Há valores pendentes' : 'Sem pendências abertas'}
            </div>
            <div className="mt-2 text-[13px] font-semibold leading-5 text-[#64748b]">
              Mostra se o caixa do mês ainda exige acompanhamento.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
