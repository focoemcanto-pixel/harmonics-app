'use client';

import AdminSummaryCard from '../admin/AdminSummaryCard';

export default function EscalasResumoTab({ resumo }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard
          label="Escalas"
          value={String(resumo.total)}
          helper="Total encontrado"
        />
        <AdminSummaryCard
          label="Confirmados"
          value={String(resumo.confirmados)}
          helper="Confirmaram presença"
          tone="success"
        />
        <AdminSummaryCard
          label="Pendentes"
          value={String(resumo.pendentes)}
          helper="Aguardando confirmação"
          tone="warning"
        />
        <AdminSummaryCard
          label="Próximos eventos"
          value={String(resumo.proximosEventos)}
          helper="Com data futura"
          tone="accent"
        />
      </div>
    </div>
  );
}
