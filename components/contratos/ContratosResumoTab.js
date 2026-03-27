'use client';

import AdminSummaryCard from '../admin/AdminSummaryCard';

export default function ContratosResumoTab({ resumo, setMobileTab }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard
          label="Contratos"
          value={String(resumo.total)}
          helper="Total encontrado"
        />
        <AdminSummaryCard
          label="Assinados"
          value={String(resumo.assinados)}
          helper="Concluídos"
          tone="success"
        />
        <AdminSummaryCard
          label="Pendentes"
          value={String(resumo.pendentes)}
          helper="Aguardando ação"
          tone="warning"
        />
        <AdminSummaryCard
          label="Não visualizados"
          value={String(resumo.naoVisualizados)}
          helper="Ainda não abertos"
          tone="accent"
        />
      </div>

      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <div className="mb-4">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
            Ações rápidas
          </div>
          <div className="mt-1 text-[20px] font-black text-[#0f172a]">
            Atalhos do módulo
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMobileTab('lista')}
            className="rounded-[20px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-4 text-left"
          >
            <div className="text-[14px] font-black text-[#0f172a]">
              Ver todos
            </div>
            <div className="mt-1 text-[13px] font-medium text-[#64748b]">
              Lista completa de contratos.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMobileTab('filtros')}
            className="rounded-[20px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-4 text-left"
          >
            <div className="text-[14px] font-black text-[#0f172a]">
              Filtrar
            </div>
            <div className="mt-1 text-[13px] font-medium text-[#64748b]">
              Refinar busca por status.
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}
