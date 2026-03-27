'use client';

import AdminSummaryCard from '../admin/AdminSummaryCard';

export default function ContatosResumoTab({
  resumo,
  healthStatus,
  tags,
  setTagFiltro,
  setDesktopTab,
  setMobileTab,
}) {
  const { label, tone, helper } = healthStatus;

  const sectionBg =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50'
      : tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'violet'
      ? 'border-violet-200 bg-violet-50'
      : 'border-[#dbe3ef] bg-[#f8fafc]';

  return (
    <div className="space-y-5">
      {/* Health banner */}
      <section
        className={`rounded-[28px] border px-5 py-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:px-6 ${sectionBg}`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-80">
              Saúde da base
            </div>

            <div className="mt-2 text-[22px] font-black leading-tight text-[#0f172a]">
              {label}
            </div>

            <div className="mt-2 text-[14px] font-medium text-[#334155]">
              {helper}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDesktopTab('visao');
                setMobileTab('lista');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[16px] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a] shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
            >
              Ver lista
            </button>

            <button
              type="button"
              onClick={() => {
                setDesktopTab('formulario');
                setMobileTab('formulario');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[16px] border border-white/70 bg-white/50 px-4 py-3 text-[14px] font-black text-[#0f172a]"
            >
              Novo contato
            </button>
          </div>
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AdminSummaryCard
          label="Total"
          value={String(resumo.total)}
          helper="Contatos no recorte atual"
        />
        <AdminSummaryCard
          label="Ativos"
          value={String(resumo.ativos)}
          helper="Contatos com status ativo"
          tone="success"
        />
        <AdminSummaryCard
          label="Completos"
          value={String(resumo.completos)}
          helper="Nome, email e telefone"
          tone="accent"
        />
      </div>

      {/* Quick actions + tags */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
              onClick={() => {
                setDesktopTab('formulario');
                setMobileTab('formulario');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[20px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-4 text-left"
            >
              <div className="text-[14px] font-black text-[#0f172a]">
                Novo contato
              </div>
              <div className="mt-1 text-[13px] font-medium text-[#64748b]">
                Adicionar cliente ou músico.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setTagFiltro('todas');
                setDesktopTab('visao');
                setMobileTab('lista');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[20px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-4 text-left"
            >
              <div className="text-[14px] font-black text-[#0f172a]">
                Ver todos
              </div>
              <div className="mt-1 text-[13px] font-medium text-[#64748b]">
                Lista completa de contatos.
              </div>
            </button>
          </div>
        </section>

        {/* Tags */}
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
          <div className="mb-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
              Tags
            </div>
            <div className="mt-1 text-[20px] font-black text-[#0f172a]">
              Segmentação
            </div>
          </div>

          {tags.length === 0 ? (
            <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#64748b]">
              Nenhuma tag cadastrada.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setTagFiltro(tag);
                    setDesktopTab('visao');
                    setMobileTab('lista');
                  }}
                  className="rounded-full border border-[#dbe3ef] bg-[#f8fafc] px-3 py-2 text-[13px] font-black text-[#0f172a]"
                >
                  {tag}{' '}
                  <span className="font-semibold text-[#64748b]">({count})</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
