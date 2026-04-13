'use client';

import { Field, Input, Select } from '../admin/AdminFormPrimitives';

export default function ContatosFormularioTab({
  editandoId,
  form,
  handleFormChange,
  salvarContato,
  cancelarEdicao,
  salvando,
  uniqueTags = [],
  firstInputRef,
}) {
  const isClient = form.contact_type === 'client';

  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
            Cadastro de contatos
          </div>
          <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[#0f172a]">
            {editandoId ? 'Editar contato' : 'Novo contato'}
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#64748b]">
            Defina o tipo corretamente para separar operação de equipe e relacionamento comercial.
          </p>
        </div>

        <div className="rounded-[18px] border border-[#e9ddff] bg-[#faf5ff] px-4 py-3 text-[13px] font-semibold text-violet-700">
          {isClient ? 'Contato comercial (cliente)' : 'Contato operacional (membro/equipe)'}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Tipo do contato">
          <Select
            value={form.contact_type}
            onChange={(e) => handleFormChange('contact_type', e.target.value)}
          >
            <option value="musician">Membro</option>
            <option value="staff">Staff</option>
            <option value="client">Cliente</option>
          </Select>
        </Field>

        <Field label="Nome">
          <Input
            ref={firstInputRef}
            value={form.name}
            onChange={(e) => handleFormChange('name', e.target.value)}
            placeholder="Ex.: Marcos Cruz"
          />
        </Field>

        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => handleFormChange('email', e.target.value)}
            placeholder="Ex.: contato@email.com"
          />
        </Field>

        <Field label={isClient ? 'WhatsApp comercial' : 'WhatsApp operacional'}>
          <Input
            value={form.phone}
            onChange={(e) => handleFormChange('phone', e.target.value)}
            placeholder="Ex.: 71999999999"
          />
        </Field>

        <Field label={isClient ? 'Segmento/Tag' : 'Função / Instrumento (tag)'}>
          <Input
            value={form.tag}
            onChange={(e) => handleFormChange('tag', e.target.value)}
            placeholder={isClient ? 'Ex.: Casamento, Corporativo' : 'Ex.: Vocal, Violão, Backing'}
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Observações internas">
            <textarea
              value={form.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              rows={4}
              placeholder="Ex.: informações úteis para operação/comercial..."
              className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-3 text-[15px] text-[#0f172a] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            />
          </Field>
        </div>
      </div>

      {uniqueTags.length > 0 ? (
        <div className="mt-6 rounded-[22px] border border-[#eef2f7] bg-[#f8fafc] p-4">
          <div className="text-[12px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Tags já usadas
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {uniqueTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleFormChange('tag', tag)}
                className="rounded-full border border-violet-200 bg-white px-3 py-2 text-[12px] font-black uppercase tracking-[0.06em] text-violet-700 transition hover:bg-violet-50"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-[22px] border border-[#dbe3ef] bg-[#f8fafc] p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={!!form.is_active}
            onChange={(e) => handleFormChange('is_active', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#cbd5e1] text-violet-600 focus:ring-violet-500"
          />
          <div>
            <div className="text-[14px] font-black text-[#0f172a]">Contato ativo</div>
            <p className="mt-1 text-[14px] leading-6 text-[#64748b]">
              Contatos inativos ficam ocultos dos fluxos de operação.
            </p>
          </div>
        </label>
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
          onClick={salvarContato}
          disabled={salvando}
          className="rounded-[18px] bg-violet-600 px-5 py-4 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar contato'}
        </button>
      </div>
    </section>
  );
}
