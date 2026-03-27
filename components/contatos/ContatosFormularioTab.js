// components/contatos/ContatosFormularioTab.js
'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';
import { Field, Input, Select } from '../eventos/EventFormPrimitives';

function SectionCard({ eyebrow, title, subtitle, children }) {
  return (
    <section className="rounded-[24px] border border-[#e6edf7] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:p-6">
      <div className="mb-5">
        {eyebrow && (
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
            {eyebrow}
          </div>
        )}

        <h3 className="mt-1 text-[20px] font-black text-[#0f172a]">{title}</h3>

        {subtitle && (
          <p className="mt-1 text-[14px] font-medium text-[#64748b]">
            {subtitle}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

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
    ? 'Atualize as informações do contato'
    : 'Preencha os dados para adicionar um novo contato';

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <AdminSectionTitle
          title={tituloPrincipal}
          subtitle={subtituloPrincipal}
        />

        <div className="space-y-5">
          {/* Seção: Informações básicas */}
          <SectionCard
            eyebrow="Dados principais"
            title="Informações básicas"
            subtitle="Nome, email e telefone são essenciais"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nome completo *">
                <Input
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="Ex: João Silva"
                />
              </Field>

              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  placeholder="Ex: joao@email.com"
                />
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Telefone / WhatsApp">
                <Input
                  value={form.phone}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
                  placeholder="Ex: (11) 98765-4321"
                />
              </Field>

              <Field label="Tag / Categoria">
                <Select
                  value={form.tag}
                  onChange={(e) => handleFormChange('tag', e.target.value)}
                >
                  <option value="">Selecione...</option>
                  <option value="cliente">Cliente</option>
                  <option value="noivo">Noivo/Noiva</option>
                  <option value="músico">Músico</option>
                  <option value="vocal">Vocal</option>
                  <option value="fornecedor">Fornecedor</option>
                  <option value="parceiro">Parceiro</option>
                  <option value="outro">Outro</option>
                </Select>
              </Field>
            </div>
          </SectionCard>

          {/* Seção: Observações e status */}
          <SectionCard
            eyebrow="Detalhes adicionais"
            title="Observações e status"
            subtitle="Informações complementares sobre o contato"
          >
            <Field label="Observações / Notas">
              <textarea
                value={form.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                placeholder="Ex: Indicado por Maria, gosta de MPB, preferência por cerimônias religiosas..."
                rows={4}
                className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none resize-none"
              />
            </Field>

            <div className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => handleFormChange('is_active', e.target.checked)}
                className="h-5 w-5 rounded border-[#dbe3ef] text-violet-600 focus:ring-2 focus:ring-violet-600"
              />
              <label htmlFor="is_active" className="text-[15px] font-semibold text-[#0f172a]">
                Contato ativo
              </label>
            </div>

            <p className="mt-2 text-[13px] text-[#64748b]">
              Contatos inativos não aparecem nas buscas principais, mas permanecem no banco de dados.
            </p>
          </SectionCard>

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={salvarContato}
              disabled={salvando}
              className="rounded-[18px] bg-violet-600 px-6 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] transition hover:bg-violet-700 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : editandoId ? 'Atualizar contato' : 'Criar contato'}
            </button>

            {editandoId && (
              <button
                type="button"
                onClick={cancelarEdicao}
                disabled={salvando}
                className="rounded-[18px] border border-[#dbe3ef] bg-white px-6 py-4 text-[15px] font-black text-[#0f172a] transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar edição
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
