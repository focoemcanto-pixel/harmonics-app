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
    },
    {
      key: 'emAberto',
      label: 'Em aberto',
      value: emAberto,
      tone: 'bg-amber-500',
      text: 'text-amber-800',
    },
    {
      key: 'custos',
      label: 'Custos',
      value: custos,
      tone: 'bg-slate-500',
      text: 'text-slate-700',
    },
    {
      key: 'lucro',
      label: 'Lucro',
      value: lucro,
      tone: 'bg-violet-500',
      text: 'text-violet-700',
    },
  ];

  const maxValue = Math.max(1, ...rows.map((item) => item.value));

  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
      <AdminSectionTitle
        title="Composição financeira"
        subtitle="Resumo visual do mês atual, destacando entrada, saldo, custos e lucro."
      />

      <div className="mt-4 rounded-[22px] border border-[#eef2f7] bg-[#fcfdff] p-4">
        <div className="rounded-[20px] bg-[#f8fafc] px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Base do mês
          </div>
          <div className="mt-2 text-[24px] font-black text-[#0f172a]">
            {formatMoney(bruto)}
          </div>
          <div className="mt-2 text-[13px] font-semibold text-[#64748b]">
            Valor bruto total considerado no período atual.
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {rows.map((item) => {
            const width = Math.max(8, Math.round((item.value / maxValue) * 100));
            const percentage = percentOf(item.value, bruto);

            return (
              <div key={item.key} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[13px] font-black uppercase tracking-[0.06em] text-[#475569]">
                      {item.label}
                    </div>
                    <div className={`mt-1 text-[18px] font-black ${item.text}`}>
                      {formatMoney(item.value)}
                    </div>
                  </div>

                  <div className="shrink-0 rounded-full bg-[#f1f5f9] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#475569]">
                    {percentage}%
                  </div>
                </div>

                <div className="h-3 w-full overflow-hidden rounded-full bg-[#eef2f7]">
                  <div
                    className={`h-full rounded-full ${item.tone}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] bg-[#f8fafc] px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Resultado do mês
            </div>
            <div className="mt-2 text-[20px] font-black text-[#0f172a]">
              {lucro >= 0 ? 'Operação positiva' : 'Operação negativa'}
            </div>
            <div className="mt-2 text-[13px] font-semibold text-[#64748b]">
              Leitura rápida da margem atual do período.
            </div>
          </div>

          <div className="rounded-[18px] bg-[#f8fafc] px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Pressão financeira
            </div>
            <div className="mt-2 text-[20px] font-black text-[#0f172a]">
              {emAberto > 0 ? 'Há valores pendentes' : 'Sem pendências abertas'}
            </div>
            <div className="mt-2 text-[13px] font-semibold text-[#64748b]">
              Mostra se o mês ainda exige atenção no caixa.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
