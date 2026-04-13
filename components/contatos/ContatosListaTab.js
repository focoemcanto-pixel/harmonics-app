'use client';

import { Input, Select } from '../admin/AdminFormPrimitives';
import { getContactTypeLabel, resolveContactType } from '@/lib/contatos/contact-type';

function TypeBadge({ contato }) {
  const type = resolveContactType(contato);
  const label = getContactTypeLabel(contato);
  const tone =
    type === 'client'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : type === 'staff'
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : 'border-violet-200 bg-violet-50 text-violet-700';

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tone}`}>
      {label}
    </span>
  );
}

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

function EmptyState({ segment }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] px-5 py-8 text-center">
      <div className="text-[18px] font-black text-[#0f172a]">Nenhum contato encontrado</div>
      <p className="mt-2 text-[15px] leading-7 text-[#64748b]">
        {segment === 'clients'
          ? 'Nenhum cliente atende aos filtros atuais.'
          : 'Ajuste os filtros para localizar membros e equipe.'}
      </p>
    </div>
  );
}

function ContatoCard({ contato, iniciarEdicao, excluirContato, allowSelection, checked, onToggle }) {
  const ativo = contato.is_active !== false;

  return (
    <article className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            {allowSelection ? (
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(contato.id)}
                className="mt-1 h-5 w-5 rounded border-[#cbd5e1] text-violet-600"
              />
            ) : null}

            <div>
              <div className="text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">{contato.name || 'Sem nome'}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TypeBadge contato={contato} />
                <StatusBadge ativo={ativo} />
                {contato.tag ? (
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-slate-700">
                    {contato.tag}
                  </span>
                ) : null}
              </div>
            </div>
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
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">Email</div>
          <div className="mt-2 break-words text-[15px] font-semibold text-[#0f172a]">{contato.email || 'Sem email cadastrado'}</div>
        </div>

        <div className="rounded-[18px] border border-[#eef2f7] bg-[#f8fafc] px-4 py-4">
          <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">Telefone</div>
          <div className="mt-2 break-words text-[15px] font-semibold text-[#0f172a]">{contato.phone || 'Sem telefone cadastrado'}</div>
        </div>
      </div>
    </article>
  );
}

export default function ContatosListaTab({
  contatosFiltrados,
  segment,
  setSegment,
  busca,
  setBusca,
  typeFilter,
  setTypeFilter,
  activeFilter,
  setActiveFilter,
  sortMode,
  setSortMode,
  iniciarEdicao,
  excluirContato,
  selectedIds,
  onToggleSelect,
  onSelectAllFiltered,
  onClearSelection,
  onBulkDeleteClients,
}) {
  const onlyClientsSegment = segment === 'clients';

  const tabs = [
    { key: 'members', label: 'Membros' },
    { key: 'clients', label: 'Clientes' },
    { key: 'all', label: 'Todos' },
  ];

  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <div className="mb-5">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">Gestão inteligente</div>
          <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[#0f172a]">Painel de contatos</h2>
          <p className="mt-2 text-[15px] leading-7 text-[#64748b]">
            Visualize equipe e clientes em contextos separados para evitar ruído operacional.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-[#f8fafc] p-2">
          {tabs.map((tab) => {
            const active = segment === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSegment(tab.key)}
                className={`rounded-2xl px-4 py-2 text-sm font-black transition ${
                  active ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, email, telefone..."
          />

          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">Todos os tipos</option>
            <option value="musician">Membro</option>
            <option value="staff">Staff</option>
            <option value="client">Cliente</option>
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

      {onlyClientsSegment && selectedIds.size > 0 ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-bold text-amber-900">{selectedIds.size} cliente(s) selecionado(s)</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSelectAllFiltered}
                className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-800"
              >
                Selecionar todos filtrados
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700"
              >
                Limpar seleção
              </button>
              <button
                type="button"
                onClick={onBulkDeleteClients}
                className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white"
              >
                Excluir clientes selecionados
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {contatosFiltrados.length === 0 ? (
        <EmptyState segment={segment} />
      ) : (
        <div className="space-y-4">
          {contatosFiltrados.map((contato) => {
            const canSelect = onlyClientsSegment && resolveContactType(contato) === 'client';
            return (
              <ContatoCard
                key={contato.id}
                contato={contato}
                iniciarEdicao={iniciarEdicao}
                excluirContato={excluirContato}
                allowSelection={canSelect}
                checked={selectedIds.has(String(contato.id))}
                onToggle={onToggleSelect}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
