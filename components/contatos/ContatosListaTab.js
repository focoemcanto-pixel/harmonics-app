'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';
import { Input, Select } from './ContatoFormPrimitives';
import ContatoCard from './ContatoCard';

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
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <AdminSectionTitle
        title="Lista de contatos"
        subtitle="Busque, filtre e gerencie todos os seus contatos."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, email, telefone..."
        />

        <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
          <option value="all">Todas as tags</option>
          {uniqueTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </Select>

        <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </Select>

        <Select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
          <option value="name_asc">Nome (A-Z)</option>
          <option value="name_desc">Nome (Z-A)</option>
          <option value="created_desc">Mais recente</option>
          <option value="created_asc">Mais antigo</option>
        </Select>
      </div>

      <div className="space-y-4">
        {contatosFiltrados.length === 0 ? (
          <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#64748b]">
            Nenhum contato encontrado.
          </div>
        ) : (
          contatosFiltrados.map((c) => (
            <ContatoCard
              key={c.id}
              id={c.id}
              name={c.name}
              email={c.email}
              phone={c.phone}
              tag={c.tag}
              notes={c.notes}
              isActive={c.is_active}
              onEdit={() => iniciarEdicao(c)}
              onDelete={() => excluirContato(c.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
