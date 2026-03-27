'use client';

import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';

export default function EscalasPage() {
  return (
    <AdminShell pageTitle="Escalas" activeItem="escalas">
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Escalas"
          subtitle="Monte equipes, acompanhe confirmações e organize a operação musical."
        />

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSectionTitle
            title="Gestão de escalas"
            subtitle="Esse módulo será a central de formação de equipe por evento."
          />

          <div className="rounded-[20px] bg-[#f8fafc] px-5 py-5 text-[14px] leading-6 text-[#475569]">
            Aqui entrarão músicos escalados, funções, status de resposta, formação
            final por evento e visão operacional do time.
          </div>
        </section>
      </div>
    </AdminShell>
  );
}