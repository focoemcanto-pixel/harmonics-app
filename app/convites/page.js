'use client';

import AdminShell from '../../components/admin/AdminShell';
import AdminPageHero from '../../components/admin/AdminPageHero';
import AdminSectionTitle from '../../components/admin/AdminSectionTitle';

export default function ConvitesPage() {
  return (
    <AdminShell pageTitle="Convites" activeItem="convites">
      <div className="space-y-5">
        <AdminPageHero
          badge="Harmonics Admin"
          title="Convites"
          subtitle="Gerencie convites enviados para músicos, confirmações e recusas."
        />

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <AdminSectionTitle
            title="Convites operacionais"
            subtitle="Esse módulo será a central de envio e acompanhamento de convites."
          />

          <div className="rounded-[20px] bg-[#f8fafc] px-5 py-5 text-[14px] leading-6 text-[#475569]">
            Aqui entrarão os convites enviados para músicos, status de confirmação,
            lembretes automáticos e histórico por evento.
          </div>
        </section>
      </div>
    </AdminShell>
  );
}