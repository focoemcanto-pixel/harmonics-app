'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';
import { Field, Input, Select, Textarea } from '../admin/AdminFormPrimitives';
import { formatPhoneDisplay } from '../../lib/contatos/contatos-format';

const DEFAULT_TAGS = ['vocal', 'noivo', 'músico', 'cliente', 'fornecedor'];

function isActiveToString(isActive) {
  return isActive ? 'active' : 'inactive';
}

function stringToIsActive(value) {
  return value === 'active';
}

export default function ContatosFormularioTab({
  editandoId,
  form,
  handleFormChange,
  salvarContato,
  cancelarEdicao,
  salvando,
  uniqueTags,
}) {
  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <AdminSectionTitle
        title={editandoId ? 'Editar contato' : 'Novo contato'}
        subtitle={editandoId ? 'Atualize as informações do contato.' : 'Preencha os dados do novo contato.'}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nome *">
          <Input
            value={form.name}
            onChange={(e) => handleFormChange('name', e.target.value)}
            placeholder="Nome completo"
          />
        </Field>

        <Field label="Tipo de contato">
          <Select
            value={form.contact_type || 'musician'}
            onChange={(e) => handleFormChange('contact_type', e.target.value)}
            disabled={salvando}
          >
            <option value="musician">Músico</option>
            <option value="staff">Técnico/Prestador</option>
            <option value="vendor">Fornecedor</option>
            <option value="client">Cliente</option>
          </Select>
        </Field>

        <Field label="Email (convites e painel)">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => handleFormChange('email', e.target.value)}
            placeholder="contato@email.com"
          />
        </Field>

        <Field label="WhatsApp">
          <Input
            value={form.phone}
            onChange={(e) => handleFormChange('phone', e.target.value)}
            placeholder="(11) 99999-9999"
          />
        </Field>

        <Field label="Tag">
          <Select value={form.tag} onChange={(e) => handleFormChange('tag', e.target.value)}>
            <option value="">Selecione uma tag</option>
            <option value="vocal">Vocal</option>
            <option value="noivo">Noivo/Noiva</option>
            <option value="músico">Músico</option>
            <option value="cliente">Cliente</option>
            <option value="fornecedor">Fornecedor</option>
            {uniqueTags && uniqueTags.filter((t) => !DEFAULT_TAGS.includes(t)).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>

        <Field label="Observações" helper="Notas internas sobre este contato">
          <Textarea
            value={form.notes}
            onChange={(e) => handleFormChange('notes', e.target.value)}
            placeholder="Ex: Músico especialista em repertório clássico"
            rows={4}
          />
        </Field>

        <Field label="Status">
          <Select value={isActiveToString(form.is_active)} onChange={(e) => handleFormChange('is_active', stringToIsActive(e.target.value))}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </Select>
        </Field>
      </div>

      {form.phone && (
        <div className="mb-6 rounded-[20px] border border-[#e6edf7] bg-[#f8fafc] p-4">
          <p className="text-[12px] font-bold text-[#64748b]">Visualização do WhatsApp</p>
          <p className="mt-1 text-[15px] font-semibold text-[#0f172a]">{formatPhoneDisplay(form.phone)}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={salvarContato}
          disabled={salvando}
          className="rounded-[18px] bg-violet-600 px-6 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] transition hover:bg-violet-700 disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : editandoId ? 'Atualizar contato' : 'Salvar contato'}
        </button>

        {editandoId && (
          <button
            type="button"
            onClick={cancelarEdicao}
            className="rounded-[18px] border border-[#dbe3ef] bg-white px-6 py-4 text-[14px] font-black text-[#0f172a] transition hover:bg-[#f8fafc]"
          >
            Cancelar edição
          </button>
        )}
      </div>
    </section>
  );
}
