'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';

export default function DashboardOperationsRadar() {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
      <AdminSectionTitle
        title="Atenção agora"
        subtitle="Radar operacional com pendências e itens que exigem ação rápida."
      />

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#475569]">
          Contratos pendentes
        </div>
        <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#475569]">
          Pagamentos pendentes
        </div>
        <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#475569]">
          Repertórios aguardando ação
        </div>
        <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#475569]">
          Escalas incompletas
        </div>
      </div>
    </section>
  );
}
