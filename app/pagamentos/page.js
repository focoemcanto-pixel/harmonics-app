'use client';

import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';

export default function PagamentosPage() {
  return (
    <AdminShell pageTitle="Pagamentos" activeItem="pagamentos">
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Pagamentos"
          subtitle="Acompanhe comprovantes, pendências e histórico financeiro por evento."
        />

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSectionTitle
            title="Controle financeiro"
            subtitle="Esse módulo será a central de entradas, comprovantes e status."
          />

          <div className="rounded-[20px] bg-[#f8fafc] px-5 py-5 text-[14px] leading-6 text-[#475569]">
            Aqui entrarão pagamentos dos clientes, comprovantes enviados, conferência,
            baixas e visão financeira por evento.
          </div>
        </section>
      </div>
    </AdminShell>
  );
}