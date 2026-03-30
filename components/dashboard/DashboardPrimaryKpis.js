'use client';

import AdminSummaryCard from '../admin/AdminSummaryCard';

function formatMoney(v) {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function DashboardPrimaryKpis({ summary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdminSummaryCard
        label="Bruto do mês"
        value={formatMoney(summary.bruto)}
        helper="Total negociado"
          size="highlight"
          
      />

      <AdminSummaryCard
        label="Líquido estimado"
        value={formatMoney(summary.liquido)}
        helper="Lucro previsto"
        tone="accent"
          size="highlight"
      />

      <AdminSummaryCard
        label="Recebido"
        value={formatMoney(summary.recebido)}
        helper="Valores confirmados"
        tone="success"
          size="highlight"
      />

      <AdminSummaryCard
        label="Em aberto"
        value={formatMoney(summary.emAberto)}
        helper="Pendências"
        tone="warning"
          size="highlight"
      />
    </div>
  );
}
