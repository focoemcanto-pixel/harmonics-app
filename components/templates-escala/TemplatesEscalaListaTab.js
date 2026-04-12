'use client';

import { Input, Select } from '../admin/AdminFormPrimitives';

function StatusBadge({ ativo }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${
        ativo
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function FormationBadge({ formation }) {
  return (
    <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">
      {formation || 'Sem formação'}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[24px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] px-5 py-8 text-center">
      <div className="text-[18px] font-black text-[#0f172a]">
        Nenhum template encontrado
      </div>
      <p className="mt-2 text-[15px] leading-7 text-[#64748b]">
        Ajuste os filtros ou crie um novo template para acelerar a montagem das escalas.
      </p>
    </div>
  );
}

function TemplateCard({ template, iniciarEdicao, excluirTemplate, alternarStatus }) {
  const ativo = template.is_active !== false;

  return (
    <article className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">
            {template.name || 'Template sem nome'}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge ativo={ativo} />
            <FormationBadge formation={template.formation} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => iniciarEdicao(template)}
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
          >
            Editar
          </button>

          <button
            type="button"
            onClick={() => alternarStatus(template)}
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
          >
            {ativo ? 'Desativar' : 'Ativar'}
          </button>

          <button
            type="button"
            onClick={() => excluirTemplate(template.id)}
            className="rounded-[16px] bg-red-600 px-4 py-3 text-[14px] font-black text-white"
          >
            Excluir
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[18px] border border-[#eef2f7] bg-[#f8fafc] px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Formação
          </div>
          <div className="mt-2 text-[15px] font-semibold text-[#0f172a]">
            {template.formation || '-'}
          </div>
        </div>

        <div className="rounded-[18px] border border-[#eef2f7] bg-[#f8fafc] px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Instrumentos
          </div>
          <div className="mt-2 text-[15px] font-semibold text-[#0f172a]">
            {template.instruments || '-'}
          </div>
        </div>

        <div className="rounded-[18px] border border-[#eef2f7] bg-[#f8fafc] px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Membros base
          </div>
          <div className="mt-2 text-[15px] font-semibold text-[#0f172a]">
            {template.items_count || 0}
          </div>
        </div>

        <div className="rounded-[18px] border border-[#eef2f7] bg-[#f8fafc] px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Prioridade
          </div>
          <div className="mt-2 text-[15px] font-semibold text-[#0f172a]">
            {template.suggestion_priority ?? 100}
          </div>
        </div>
      </div>

      {template.compatible_tags ? (
        <div className="mt-4 rounded-[18px] border border-[#eef2f7] bg-white px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Tags compatíveis
          </div>
          <div className="mt-2 text-[14px] leading-7 text-[#64748b]">{template.compatible_tags}</div>
        </div>
      ) : null}

      {template.notes ? (
        <div className="mt-4 rounded-[18px] border border-[#eef2f7] bg-white px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Observações
          </div>
          <div className="mt-2 text-[14px] leading-7 text-[#64748b]">
            {template.notes}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function TemplatesEscalaListaTab({
  templates,
  busca,
  setBusca,
  formationFilter,
  setFormationFilter,
  activeFilter,
  setActiveFilter,
  formations,
  iniciarEdicao,
  excluirTemplate,
  alternarStatus,
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <div className="mb-5">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
            Base inteligente
          </div>
          <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[#0f172a]">
            Lista de templates
          </h2>
          <p className="mt-2 text-[15px] leading-7 text-[#64748b]">
            Cadastre formações padrão para sugerir automaticamente a equipe base quando abrir a escala.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, formação, instrumentos..."
          />

          <Select value={formationFilter} onChange={(e) => setFormationFilter(e.target.value)}>
            <option value="all">Todas as formações</option>
            {formations.map((formation) => (
              <option key={formation} value={formation}>
                {formation}
              </option>
            ))}
          </Select>

          <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
            <option value="all">Todos os status</option>
            <option value="active">Somente ativos</option>
            <option value="inactive">Somente inativos</option>
          </Select>
        </div>
      </div>

      {templates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              iniciarEdicao={iniciarEdicao}
              excluirTemplate={excluirTemplate}
              alternarStatus={alternarStatus}
            />
          ))}
        </div>
      )}
    </section>
  );
}
