'use client';

import { useEffect, useState } from 'react';
import AdminSectionTitle from '../admin/AdminSectionTitle';
import { Field, Input, Select, Textarea } from '../admin/AdminFormPrimitives';
import { formatDateBR } from '../../lib/escalas/escalas-format';

const ROLES = [
  'Vocal principal',
  'Vocal backup',
  'Guitarra',
  'Baixo',
  'Teclado',
  'Bateria',
  'Percussão',
  'Violino',
  'Saxofone',
  'Outro',
];

export default function EscalasFormularioTab({
  editandoId,
  form,
  handleFormChange,
  onSave,
  onCancel,
  salvando,
  eventos,
  contatos,
}) {
  const [selectedContact, setSelectedContact] = useState(null);

  useEffect(() => {
    if (form.musician_id && contatos.length > 0) {
      const contact = contatos.find((c) => c.id === form.musician_id);
      setSelectedContact(contact || null);
    } else {
      setSelectedContact(null);
    }
  }, [form.musician_id, contatos]);

  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <AdminSectionTitle
        title={editandoId ? 'Editar escala' : 'Nova escala'}
        subtitle={editandoId ? 'Atualize os dados da escala.' : 'Escale um músico ou prestador para um evento.'}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Evento *">
          <Select
            value={form.event_id || ''}
            onChange={(e) => handleFormChange('event_id', e.target.value)}
            disabled={salvando}
          >
            <option value="">Selecione um evento</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.client_name}{ev.event_date ? ` — ${formatDateBR(ev.event_date)}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Músico / Prestador *">
          <Select
            value={form.musician_id || ''}
            onChange={(e) => handleFormChange('musician_id', e.target.value)}
            disabled={salvando}
          >
            <option value="">Selecione um músico</option>
            {contatos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.email ? '' : ' ⚠️'}
              </option>
            ))}
          </Select>
        </Field>

        {selectedContact && !selectedContact.email && (
          <div className="md:col-span-2 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
            <strong>⚠️ Atenção:</strong> Este músico não tem email cadastrado.{' '}
            <a
              href="/contatos"
              target="_blank"
              className="ml-1 font-bold underline"
            >
              Complete o cadastro
            </a>{' '}
            antes de salvar a escala.
          </div>
        )}

        <Field label="Função / Instrumento *">
          <Select
            value={form.role || ''}
            onChange={(e) => handleFormChange('role', e.target.value)}
            disabled={salvando}
          >
            <option value="">Selecione uma função</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </Field>

        <Field label="Status">
          <Select
            value={form.status || 'pending'}
            onChange={(e) => handleFormChange('status', e.target.value)}
            disabled={salvando}
          >
            <option value="pending">Aguardando</option>
            <option value="confirmed">Confirmado</option>
            <option value="declined">Recusado</option>
            <option value="backup">Backup</option>
          </Select>
        </Field>

        <Field label="Observações" helper="Notas internas sobre esta escala">
          <Textarea
            value={form.notes || ''}
            onChange={(e) => handleFormChange('notes', e.target.value)}
            placeholder="Ex: Confirmar equipamento de som"
            rows={3}
            disabled={salvando}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={salvando}
          className="rounded-[18px] bg-violet-600 px-6 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] transition hover:bg-violet-700 disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : editandoId ? 'Atualizar escala' : 'Salvar escala'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[18px] border border-[#dbe3ef] bg-white px-6 py-4 text-[14px] font-black text-[#0f172a] transition hover:bg-[#f8fafc]"
          >
            Cancelar
          </button>
        )}
      </div>
    </section>
  );
}
