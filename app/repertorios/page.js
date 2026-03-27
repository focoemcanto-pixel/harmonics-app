'use client';

import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';

export default function RepertoriosPage() {
  return (
    <AdminShell pageTitle="Repertórios" activeItem="repertorios">
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Repertórios"
          subtitle="Acompanhe repertórios enviados pelos clientes e organize correções."
        />

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSectionTitle
            title="Fluxo de repertório"
            subtitle="Esse módulo será a central de revisão, aprovação e ajustes."
          />

          <div className="rounded-[20px] bg-[#f8fafc] px-5 py-5 text-[14px] leading-6 text-[#475569]">
            Aqui entrarão repertórios enviados, status, pedidos de correção,
            revisão final e integração com o painel do cliente.
          </div>
        </section>
      </div>
    </AdminShell>
  );
}