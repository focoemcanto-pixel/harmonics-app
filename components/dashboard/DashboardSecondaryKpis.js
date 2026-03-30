'use client';

import AdminSummaryCard from '../admin/AdminSummaryCard';

export default function DashboardSecondaryKpis() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <AdminSummaryCard
        label="Eventos do mês"
        value="0"
        helper="Eventos visíveis no período"
      />
      <AdminSummaryCard
        label="Próximos 7 dias"
        value="0"
        helper="Agenda imediata"
        tone="accent"
      />
      <AdminSummaryCard
        label="Contratos pendentes"
        value="0"
        helper="Operação contratual"
        tone="warning"
      />
      <AdminSummaryCard
        label="Pré-contratos ativos"
        value="0"
        helper="Fluxo comercial"
      />
      <AdminSummaryCard
        label="Pagamentos pendentes"
        value="0"
        helper="Financeiro em aberto"
        tone="warning"
      />
      <AdminSummaryCard
        label="Escalas pendentes"
        value="0"
        helper="Operação musical"
        tone="accent"
      />
    </div>
  );
}
