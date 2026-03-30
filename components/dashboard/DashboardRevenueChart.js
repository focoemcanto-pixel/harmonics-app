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

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  });
}

function buildMonthlySeries(events = [], monthsBack = 6) {
  const now = new Date();
  const buckets = [];

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = getMonthKey(d);

    buckets.push({
      key,
      label: getMonthLabel(key),
      bruto: 0,
      liquido: 0,
    });
  }

  const map = new Map(buckets.map((item) => [item.key, item]));

  for (const ev of events) {
    if (!ev?.event_date) continue;

    const date = new Date(`${ev.event_date}T00:00:00`);
    if (Number.isNaN(date.getTime())) continue;

    const key = getMonthKey(date);
    const bucket = map.get(key);

    if (!bucket) continue;

    bucket.bruto += toNumber(ev.agreed_amount);
    bucket.liquido += toNumber(ev.profit_amount);
  }

  return buckets;
}

export default function DashboardRevenueChart({ events = [] }) {
  const series = buildMonthlySeries(events, 6);

  const maxValue = Math.max(
    1,
    ...series.flatMap((item) => [item.bruto, item.liquido])
  );

  const totalBruto = series.reduce((acc, item) => acc + item.bruto, 0);
  const totalLiquido = series.reduce((acc, item) => acc + item.liquido, 0);

  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
      <AdminSectionTitle
        title="Evolução financeira"
        subtitle="Leitura dos últimos 6 meses, comparando bruto e líquido real dos eventos."
      />

      <div className="mt-4 rounded-[22px] border border-[#eef2f7] bg-[#fcfdff] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-[18px] bg-[#f8fafc] px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Bruto acumulado
            </div>
            <div className="mt-2 text-[22px] font-black text-[#0f172a]">
              {formatMoney(totalBruto)}
            </div>
          </div>

          <div className="rounded-[18px] bg-[#f8fafc] px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
              Líquido acumulado
            </div>
            <div className="mt-2 text-[22px] font-black text-[#0f172a]">
              {formatMoney(totalLiquido)}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-[12px] font-black text-[#475569]">
            <span className="inline-block h-3 w-3 rounded-full bg-violet-500" />
            Bruto
          </div>

          <div className="flex items-center gap-2 text-[12px] font-black text-[#475569]">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
            Líquido
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <div className="flex min-w-[560px] items-end gap-4">
            {series.map((item) => {
              const brutoHeight = Math.max(
                8,
                Math.round((item.bruto / maxValue) * 180)
              );
              const liquidoHeight = Math.max(
                8,
                Math.round((item.liquido / maxValue) * 180)
              );

              return (
                <div
                  key={item.key}
                  className="flex flex-1 flex-col items-center"
                >
                  <div className="flex h-[220px] items-end gap-2">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-5 rounded-t-[10px] bg-violet-500 shadow-[0_8px_18px_rgba(124,58,237,0.22)]"
                        style={{ height: `${brutoHeight}px` }}
                        title={`Bruto: ${formatMoney(item.bruto)}`}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <div
                        className="w-5 rounded-t-[10px] bg-emerald-500 shadow-[0_8px_18px_rgba(16,185,129,0.18)]"
                        style={{ height: `${liquidoHeight}px` }}
                        title={`Líquido: ${formatMoney(item.liquido)}`}
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-center">
                    <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
                      {item.label}
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="text-[11px] font-semibold text-violet-700">
                        {formatMoney(item.bruto)}
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-700">
                        {formatMoney(item.liquido)}
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
