'use client';

import { useMemo, useState } from 'react';
import { Field, Input, Select } from '../admin/AdminFormPrimitives';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function MemberChip({ item, index, atualizarItem, removerItem }) {
  return (
    <div className="rounded-[22px] border border-[#dbe3ef] bg-white p-4 shadow-[0_8px_22px_rgba(17,24,39,0.04)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-[18px] font-black text-[#0f172a]">
            {item.name || 'Membro sem nome'}
          </div>
          <div className="mt-1 text-[14px] text-[#64748b]">
            {item.phone || 'Sem telefone'}
            {item.email ? ` • ${item.email}` : ''}
          </div>
          {item.tag ? (
            <div className="mt-2">
              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-violet-700">
                {item.tag}
              </span>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => removerItem(index)}
          className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-black text-red-700"
        >
          Remover
        </button>
      </div>

      <div className="mt-4">
        <Field label="Função padrão na formação">
          <Input
            value={item.role}
            onChange={(e) => atualizarItem(index, 'role', e.target.value)}
            placeholder="Ex.: Voz principal, Violão, Piano..."
          />
        </Field>
      </div>
    </div>
  );
}

export default function TemplatesEscalaFormularioTab({
  editandoId,
  form,
  handleFormChange,
  salvarTemplate,
  cancelarEdicao,
  salvando,
  formations,
  contatosDisponiveis,
  itens,
  adicionarContatoAoTemplate,
  removerItem,
  atualizarItem,
}) {
  const [buscaMembro, setBuscaMembro] = useState('');

  const contatosFiltrados = useMemo(() => {
    const termo = normalizeText(buscaMembro);
    if (!termo) return contatosDisponiveis.slice(0, 12);

    return contatosDisponiveis
      .filter((contato) =>
        [contato.name, contato.email, contato.phone, contato.tag]
          .filter(Boolean)
          .some((value) => normalizeText(value).includes(termo))
      )
      .slice(0, 12);
  }, [buscaMembro, contatosDisponiveis]);

  return (
    <section className="space-y-5">
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
              Automação operacional
            </div>
            <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[#0f172a]">
              {editandoId ? 'Editar template' : 'Novo template'}
            </h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#64748b]">
              Defina uma formação base para sugerir automaticamente a equipe ao abrir a escala do evento.
            </p>
          </div>

          <div className="rounded-[18px] border border-[#e9ddff] bg-[#faf5ff] px-4 py-3 text-[13px] font-semibold text-violet-700">
            Sugere equipe, mas não salva automaticamente
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Nome do template">
            <Input
              value={form.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder="Ex.: Trio Base Casamento"
            />
          </Field>

          <Field label="Formação">
            <Select
              value={form.formation}
              onChange={(e) => handleFormChange('formation', e.target.value)}
            >
              <option value="">Selecione</option>
              {formations.map((formation) => (
                <option key={formation} value={formation}>
                  {formation}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Instrumentos esperados">
            <Input
              value={form.instruments}
              onChange={(e) => handleFormChange('instruments', e.target.value)}
              placeholder="Ex.: Voz, Violão, Teclado"
            />
          </Field>

          <Field label="Tags compatíveis">
            <Input
              value={form.compatible_tags || ''}
              onChange={(e) => handleFormChange('compatible_tags', e.target.value)}
              placeholder="Ex.: casamento, cerimônia clássica, corporativo"
            />
          </Field>

          <Field label="Prioridade da sugestão">
            <Input
              type="number"
              min="1"
              value={form.suggestion_priority ?? 100}
              onChange={(e) => handleFormChange('suggestion_priority', e.target.value)}
              placeholder="100"
            />
          </Field>

          <div className="rounded-[22px] border border-[#dbe3ef] bg-[#f8fafc] p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={(e) => handleFormChange('is_active', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#cbd5e1] text-violet-600 focus:ring-violet-500"
              />
              <div>
                <div className="text-[14px] font-black text-[#0f172a]">
                  Template ativo
                </div>
                <p className="mt-1 text-[14px] leading-6 text-[#64748b]">
                  Quando ativo, ele pode ser sugerido automaticamente na escala.
                </p>
              </div>
            </label>
          </div>

          <div className="md:col-span-2">
            <Field label="Observações">
              <textarea
                value={form.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                rows={4}
                placeholder="Ex.: template padrão para cerimônia clássica com time principal"
                className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
          Membros base
        </div>
        <h3 className="mt-2 text-[24px] font-black tracking-[-0.03em] text-[#0f172a]">
          Equipe padrão da formação
        </h3>
        <p className="mt-2 text-[15px] leading-7 text-[#64748b]">
          Escolha os membros mais frequentes dessa formação. Você poderá revisar tudo antes de salvar a escala real do evento.
        </p>

        <div className="mt-5 rounded-[22px] border border-[#e7edf5] bg-[#fafbff] p-4">
          <Input
            value={buscaMembro}
            onChange={(e) => setBuscaMembro(e.target.value)}
            placeholder="Buscar membro por nome, tag, email ou WhatsApp..."
          />

          <div className="mt-4 overflow-hidden rounded-[18px] border border-[#e7edf5] bg-white">
            {contatosFiltrados.length === 0 ? (
              <div className="px-4 py-4 text-[14px] font-semibold text-[#64748b]">
                Nenhum membro encontrado.
              </div>
            ) : (
              contatosFiltrados.map((contato, index) => (
                <button
                  key={contato.id}
                  type="button"
                  onClick={() => adicionarContatoAoTemplate(contato)}
                  className={`block w-full px-4 py-4 text-left transition hover:bg-[#f8fafc] ${
                    index > 0 ? 'border-t border-[#eef2f7]' : ''
                  }`}
                >
                  <div className="text-[16px] font-black text-[#0f172a]">
                    {contato.name || 'Sem nome'}
                  </div>

                  <div className="mt-1 text-[14px] font-semibold leading-6 text-[#64748b]">
                    {[contato.tag, contato.phone, contato.email]
                      .filter(Boolean)
                      .join(' — ')}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {itens.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] px-4 py-5 text-[15px] font-semibold text-[#64748b]">
              Nenhum membro adicionado ao template ainda.
            </div>
          ) : (
            itens.map((item, index) => (
              <MemberChip
                key={`${item.contact_id}-${index}`}
                item={item}
                index={index}
                atualizarItem={atualizarItem}
                removerItem={removerItem}
              />
            ))
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
          <button
            type="button"
            onClick={cancelarEdicao}
            disabled={salvando}
            className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[15px] font-black text-[#0f172a] disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={salvarTemplate}
            disabled={salvando}
            className="rounded-[18px] bg-violet-600 px-5 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : editandoId ? 'Salvar template' : 'Cadastrar template'}
          </button>
        </div>
      </section>
    </section>
  );
}
