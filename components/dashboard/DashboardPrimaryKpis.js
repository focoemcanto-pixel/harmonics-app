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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <AdminSummaryCard
        label="Receita contratada"
        value={formatMoney(summary?.receitaContratada)}
        helper="Receita contratada do mês"
        size="highlight"
      />

      <AdminSummaryCard
        label="Recebido"
        value={formatMoney(summary?.recebido)}
        helper="Pagamentos confirmados do mês"
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

      <AdminSummaryCard
        label="Custos totais"
        value={formatMoney(summary?.custosTotais)}
        helper="Custos dos eventos do mês"
        tone="accent"
        size="highlight"
      />

      <AdminSummaryCard
        label="Lucro previsto"
        value={formatMoney(summary?.lucroPrevisto)}
        helper="Receita contratada - custos totais"
        tone="accent"
        size="highlight"
      />
    </div>
  );
}
