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

function TagBadge({ tag }) {
  if (!tag) return null;

  return (
    <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">
      {tag}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[24px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] px-5 py-8 text-center">
      <div className="text-[18px] font-black text-[#0f172a]">
        Nenhum membro encontrado
      </div>
      <p className="mt-2 text-[15px] leading-7 text-[#64748b]">
        Ajuste os filtros ou cadastre um novo membro para começar a montar suas escalas.
      </p>
    </div>
  );
}

function MembroCard({ contato, iniciarEdicao, excluirContato }) {
  const ativo = contato.is_active !== false;

  return (
    <article className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">
            {contato.name || 'Sem nome'}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge ativo={ativo} />
            <TagBadge tag={contato.tag} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => iniciarEdicao(contato)}
            className="rounded-[16px] border border-[#dbe3ef] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a]"
          >
            Editar
          </button>

          <button
            type="button"
            onClick={() => excluirContato(contato.id)}
            className="rounded-[16px] bg-red-600 px-4 py-3 text-[14px] font-black text-white"
          >
            Excluir
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-[18px] border border-[#eef2f7] bg-[#f8fafc] px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Email de acesso
          </div>
          <div className="mt-2 break-words text-[15px] font-semibold text-[#0f172a]">
            {contato.email || 'Sem email cadastrado'}
          </div>
        </div>

        <div className="rounded-[18px] border border-[#eef2f7] bg-[#f8fafc] px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            WhatsApp operacional
          </div>
          <div className="mt-2 break-words text-[15px] font-semibold text-[#0f172a]">
            {contato.phone || 'Sem WhatsApp cadastrado'}
          </div>
        </div>
      </div>

      {contato.notes ? (
        <div className="mt-4 rounded-[18px] border border-[#eef2f7] bg-white px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Observações
          </div>
          <div className="mt-2 text-[14px] leading-7 text-[#64748b]">
            {contato.notes}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function ContatosListaTab({
  contatosFiltrados,
  busca,
  setBusca,
  tagFilter,
  setTagFilter,
  activeFilter,
  setActiveFilter,
  sortMode,
  setSortMode,
  uniqueTags,
  iniciarEdicao,
  excluirContato,
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <div className="mb-5">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
            Base operacional
          </div>
          <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[#0f172a]">
            Lista de membros
          </h2>
          <p className="mt-2 text-[15px] leading-7 text-[#64748b]">
            Filtre sua equipe por nome, tag e status para encontrar rapidamente quem vai para a escala.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, email, WhatsApp..."
          />

          <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="all">Todas as tags</option>
            {uniqueTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </Select>

          <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
            <option value="all">Todos os status</option>
            <option value="active">Somente ativos</option>
            <option value="inactive">Somente inativos</option>
          </Select>

          <Select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            <option value="name_asc">Nome A-Z</option>
            <option value="name_desc">Nome Z-A</option>
            <option value="created_desc">Mais recentes</option>
            <option value="created_asc">Mais antigos</option>
          </Select>
        </div>
      </div>

      {contatosFiltrados.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {contatosFiltrados.map((contato) => (
            <MembroCard
              key={contato.id}
              contato={contato}
              iniciarEdicao={iniciarEdicao}
              excluirContato={excluirContato}
            />
          ))}
        </div>
      )}
    </section>
  );
}
