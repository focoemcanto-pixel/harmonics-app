'use client';

import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSummaryCard from '../../components/admin/AdminSummaryCard';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';

export default function DashboardPage() {
  return (
    <AdminShell pageTitle="Dashboard" activeItem="dashboard">
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Dashboard"
          subtitle="Acompanhe os indicadores principais da operação em um só lugar."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminSummaryCard
            label="Eventos do mês"
            value="12"
            helper="Visão geral"
          />
          <AdminSummaryCard
            label="A receber"
            value="R$ 8.400,00"
            helper="Pagamentos pendentes"
            tone="warning"
          />
          <AdminSummaryCard
            label="Recebido"
            value="R$ 15.700,00"
            helper="Valores confirmados"
            tone="success"
          />
          <AdminSummaryCard
            label="Contratos ativos"
            value="9"
            helper="Em andamento"
            tone="accent"
          />
        </div>

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSectionTitle
            title="Visão geral"
            subtitle="Esse módulo será a central de indicadores, tarefas e alertas do sistema."
          />

          <div className="rounded-[20px] bg-[#f8fafc] px-5 py-5 text-[14px] leading-6 text-[#475569]">
            Aqui entrarão os resumos operacionais do dia, próximos eventos, contratos pendentes,
            pagamentos em aberto e alertas importantes da operação.
          </div>
        </section>
      </div>
    </AdminShell>
  );
}