'use client';

import AdminSummaryCard from '../admin/AdminSummaryCard';

export default function DashboardSecondaryKpis({ summary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <AdminSummaryCard
        label="Eventos do mês"
        value={String(summary?.eventosMes || 0)}
        helper="Eventos visíveis no período"
      />

      <AdminSummaryCard
        label="Próximos 7 dias"
        value={String(summary?.proximos || 0)}
        helper="Agenda imediata"
        tone="accent"
      />

      <AdminSummaryCard
        label="Contratos pendentes"
        value={String(summary?.contratosPendentes || 0)}
        helper="Operação contratual"
        tone="warning"
      />

      <AdminSummaryCard
        label="Pré-contratos ativos"
        value={String(summary?.precontractsAtivos || 0)}
        helper="Fluxo comercial"
      />

      <AdminSummaryCard
        label="Pagamentos pendentes"
        value={String(summary?.pagamentosPendentes || 0)}
        helper="Financeiro em aberto"
        tone="warning"
      />

      <AdminSummaryCard
        label="Escalas pendentes"
        value={String(summary?.escalasPendentes || 0)}
        helper="Operação musical"
        tone="accent"
      />
    </div>
  );
}
