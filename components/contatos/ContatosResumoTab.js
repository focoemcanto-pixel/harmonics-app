// components/contatos/ContatosResumoTab.js
'use client';

import AdminSummaryCard from '../admin/AdminSummaryCard';
import { getUniqueTags, countByTag } from '../../lib/contatos/contatos-filters';
import { getTagToneClasses } from '../../lib/contatos/contatos-ui';

export default function ContatosResumoTab({
  contatos,
  contatosFiltrados,
  setTagFilter,
  setStatusFilter,
  setDesktopTab,
  setMobileTab,
}) {
  const totalContatos = contatos.length;
  const contatosAtivos = contatos.filter((c) => c.is_active).length;
  const contatosInativos = totalContatos - contatosAtivos;

  const contatosCompletos = contatos.filter((c) => c.name && c.email && c.phone).length;
  const contatosIncompletos = totalContatos - contatosCompletos;

  const uniqueTags = getUniqueTags(contatos);
  const tagCounts = countByTag(contatos);

  const topTags = uniqueTags
    .map((tag) => ({
      tag,
      count: tagCounts[tag] || 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Banner de saúde */}
      <section className="rounded-[28px] border border-violet-200 bg-violet-50 px-5 py-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
              Base de contatos
            </div>

            <div className="mt-2 text-[22px] font-black leading-tight text-[#0f172a]">
              {totalContatos} contato{totalContatos !== 1 ? 's' : ''} cadastrado{totalContatos !== 1 ? 's' : ''}
            </div>

            <p className="mt-2 text-[14px] font-medium text-violet-800">
              {contatosAtivos} ativo{contatosAtivos !== 1 ? 's' : ''} •{' '}
              {contatosIncompletos > 0
                ? `${contatosIncompletos} incompleto${contatosIncompletos !== 1 ? 's' : ''}`
                : 'Todos completos'}
            </p>
          </div>
        </div>
      </section>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard
          label="Total de contatos"
          value={String(totalContatos)}
          helper="Base completa"
          tone="default"
        />

        <AdminSummaryCard
          label="Contatos ativos"
          value={String(contatosAtivos)}
          helper={`${contatosInativos} inativo${contatosInativos !== 1 ? 's' : ''}`}
          tone="success"
        />

        <AdminSummaryCard
          label="Cadastros completos"
          value={String(contatosCompletos)}
          helper={`${contatosIncompletos} pendente${contatosIncompletos !== 1 ? 's' : ''}`}
          tone="accent"
        />

        <AdminSummaryCard
          label="Categorias"
          value={String(uniqueTags.length)}
          helper="Tags únicas"
          tone="default"
        />
      </div>

      {/* Top tags */}
      {topTags.length > 0 && (
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
          <div className="mb-4">
            <h3 className="text-[18px] font-black text-[#0f172a]">Principais categorias</h3>
            <p className="mt-1 text-[14px] text-[#64748b]">
              Distribuição por tag
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {topTags.map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setTagFilter(tag);
                  setDesktopTab('visao');
                  setMobileTab('lista');
                }}
                className={`group rounded-[18px] px-4 py-3 text-left transition ${getTagToneClasses(tag)} hover:scale-105 hover:shadow-lg`}
              >
                <div className="text-[13px] font-bold capitalize">{tag}</div>
                <div className="text-[11px] font-black opacity-70">
                  {count} contato{count !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Ações rápidas */}
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <div className="mb-4">
          <h3 className="text-[18px] font-black text-[#0f172a]">Filtros rápidos</h3>
          <p className="mt-1 text-[14px] text-[#64748b]">
            Navegue pela base de contatos
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ativos');
              setDesktopTab('visao');
              setMobileTab('lista');
            }}
            className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-5 py-3 text-[14px] font-black text-emerald-700 transition hover:bg-emerald-100"
          >
            Ver ativos ({contatosAtivos})
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('inativos');
              setDesktopTab('visao');
              setMobileTab('lista');
            }}
            className="rounded-[18px] border border-slate-200 bg-slate-50 px-5 py-3 text-[14px] font-black text-slate-700 transition hover:bg-slate-100"
          >
            Ver inativos ({contatosInativos})
          </button>

          {contatosIncompletos > 0 && (
            <button
              type="button"
              onClick={() => {
                setDesktopTab('visao');
                setMobileTab('lista');
              }}
              className="rounded-[18px] border border-amber-200 bg-amber-50 px-5 py-3 text-[14px] font-black text-amber-700 transition hover:bg-amber-100"
            >
              Ver incompletos ({contatosIncompletos})
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
