'use client';

import AdminSummaryCard from '../admin/AdminSummaryCard';

export default function DashboardPrimaryKpis() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdminSummaryCard
        label="Bruto do mês"
        value="R$ 0,00"
        helper="Total negociado no período"
      />
      <AdminSummaryCard
        label="Líquido estimado"
        value="R$ 0,00"
        helper="Lucro previsto"
        tone="accent"
      />
      <AdminSummaryCard
        label="Recebido"
        value="R$ 0,00"
        helper="Valores já confirmados"
        tone="success"
      />
      <AdminSummaryCard
        label="Em aberto"
        value="R$ 0,00"
        helper="Valores pendentes"
        tone="warning"
      />
    </div>
  );
}
