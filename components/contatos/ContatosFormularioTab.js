'use client';

import { Field, Input, Select } from '../eventos/EventFormPrimitives';

export default function ContatosFormularioTab({
  editandoId,
  form,
  handleFormChange,
  salvarContato,
  cancelarEdicao,
  salvando,
}) {
  const tituloPrincipal = editandoId ? 'Editar contato' : 'Novo contato';
  const subtituloPrincipal = editandoId
    ? 'Atualize os dados do contato sem perder o vínculo com eventos e contratos.'
    : 'Preencha os dados principais do contato. Nome é obrigatório.';

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
            Gestão de contatos
          </div>
          <h2 className="mt-1 text-[28px] font-black leading-tight text-[#0f172a]">
            {tituloPrincipal}
          </h2>
          <p className="mt-2 max-w-[720px] text-[15px] font-medium text-[#64748b]">
            {subtituloPrincipal}
          </p>
        </div>
      </section>

      {/* Identity section */}
      <section className="rounded-[24px] border border-[#e6edf7] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:p-6">
        <div className="mb-5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
            Identidade
          </div>
          <h3 className="mt-1 text-[20px] font-black text-[#0f172a]">
            Dados principais
          </h3>
          <p className="mt-1 text-[14px] font-medium text-[#64748b]">
            Nome, email e telefone são os dados centrais do contato.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Nome *">
              <Input
                value={form.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="Nome completo"
              />
            </Field>
          </div>

          <Field label="Email (login do painel)">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => handleFormChange('email', e.target.value)}
              placeholder="email@exemplo.com"
            />
          </Field>

          <Field label="WhatsApp">
            <Input
              value={form.phone}
              onChange={(e) => handleFormChange('phone', e.target.value)}
              placeholder="(XX) XXXXX-XXXX"
            />
          </Field>
        </div>
      </section>

      {/* Categorization section */}
      <section className="rounded-[24px] border border-[#e6edf7] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:p-6">
        <div className="mb-5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
            Categorização
          </div>
          <h3 className="mt-1 text-[20px] font-black text-[#0f172a]">
            Tag e status
          </h3>
          <p className="mt-1 text-[14px] font-medium text-[#64748b]">
            Tags e status ajudam a filtrar e segmentar seus contatos.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Tag (ex: vocal, noivo, músico)">
            <Input
              value={form.tag}
              onChange={(e) => handleFormChange('tag', e.target.value)}
              placeholder="vocal, noivo, músico..."
            />
          </Field>

          <Field label="Status">
            <Select
              value={form.is_active ? 'ativo' : 'inativo'}
              onChange={(e) =>
                handleFormChange('is_active', e.target.value === 'ativo')
              }
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </Select>
          </Field>

          <div className="md:col-span-2">
            <Field label="Observações">
              <textarea
                value={form.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                rows={4}
                placeholder="Notas internas sobre o contato..."
                className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
              Ações
            </div>
            <h3 className="mt-1 text-[20px] font-black text-[#0f172a]">
              Finalizar cadastro
            </h3>
            <p className="mt-1 text-[14px] font-medium text-[#64748b]">
              Salve o contato e mantenha a base atualizada.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={salvarContato}
              disabled={salvando}
              className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] disabled:opacity-60"
            >
              {salvando
                ? 'Salvando...'
                : editandoId
                ? 'Atualizar contato'
                : 'Criar contato'}
            </button>

            {editandoId ? (
              <button
                type="button"
                onClick={cancelarEdicao}
                className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[14px] font-black text-[#0f172a]"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
