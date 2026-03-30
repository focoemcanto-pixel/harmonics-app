'use client';

import AdminSummaryCard from '../admin/AdminSummaryCard';

function formatMoney(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function DashboardPrimaryKpis({ summary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdminSummaryCard
        label="Bruto do mês"
        value={formatMoney(summary?.bruto)}
        helper="Total negociado no período"
        size="highlight"
      />

      <AdminSummaryCard
        label="Líquido estimado"
        value={formatMoney(summary?.liquido)}
        helper="Margem prevista da operação"
        tone="accent"
        size="highlight"
      />

      <AdminSummaryCard
        label="Recebido"
        value={formatMoney(summary?.recebido)}
        helper="Valores já confirmados"
        tone="success"
        size="highlight"
      />

      <AdminSummaryCard
        label="Em aberto"
        value={formatMoney(summary?.emAberto)}
        helper="Pendências financeiras do mês"
        tone="warning"
        size="highlight"
      />
    </div>
  );
}
