'use client';

import AdminPageHero from '../admin/AdminPageHero';

export default function DashboardHero() {
  return (
    <AdminPageHero
      badge="Harmonics Admin"
      title="Dashboard"
      subtitle="Acompanhe a saúde financeira e operacional do negócio em uma visão premium, rápida e clara."
      actions={
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[14px] font-black text-[#0f172a]"
          >
            Ver operação
          </button>

          <button
            type="button"
            className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
          >
            Novo evento
          </button>
        </div>
      }
    />
  );
}
