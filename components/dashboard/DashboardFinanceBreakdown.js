'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';

export default function DashboardFinanceBreakdown() {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
      <AdminSectionTitle
        title="Composição financeira"
        subtitle="Resumo visual de recebido, em aberto, custos e lucro."
      />

      <div className="mt-4 rounded-[20px] bg-[#f8fafc] px-5 py-12 text-center text-[14px] font-semibold text-[#64748b]">
        Bloco financeiro complementar
      </div>
    </section>
  );
}
