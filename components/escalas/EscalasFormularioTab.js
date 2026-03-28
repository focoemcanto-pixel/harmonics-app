'use client';

import { useState, useEffect } from 'react';
import AdminSectionTitle from '../admin/AdminSectionTitle';
import { Field, Input, Select, Textarea } from '../admin/AdminFormPrimitives';

export default function EscalasFormularioTab({
  escalaSelecionada,
  eventos,
  contatos,
  onSave,
  onCancel,
  salvando = false,
}) {
  const [form, setForm] = useState({
    event_id: '',
    musician_id: '',
    role: '',
    status: 'pending',
    notes: '',
  });

  useEffect(() => {
    if (escalaSelecionada) {
      setForm({
        event_id: escalaSelecionada.event_id || '',
        musician_id: escalaSelecionada.musician_id || '',
        role: escalaSelecionada.role || '',
        status: escalaSelecionada.status || 'pending',
        notes: escalaSelecionada.notes || '',
      });
    } else {
      setForm({
        event_id: '',
        musician_id: '',
        role: '',
        status: 'pending',
        notes: '',
      });
    }
  }, [escalaSelecionada]);

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.event_id) {
      alert('Selecione um evento');
      return;
    }
    if (!form.musician_id) {
      alert('Selecione um músico');
      return;
    }
    if (!form.role.trim()) {
      alert('Informe a função/instrumento');
      return;
    }

    onSave(form);
  }

  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
      <AdminSectionTitle
        title={escalaSelecionada ? 'Editar escala' : 'Nova escala'}
        subtitle="Atribua músicos aos eventos"
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Evento */}
        <Field label="Evento">
          <Select
            value={form.event_id}
            onChange={(e) => setForm({ ...form, event_id: e.target.value })}
            disabled={salvando}
          >
            <option value="">Selecione um evento</option>
            {eventos.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.client_name} - {evt.event_date}
              </option>
            ))}
          </Select>
        </Field>

        {/* Músico */}
        <Field label="Músico">
          <Select
            value={form.musician_id}
            onChange={(e) => setForm({ ...form, musician_id: e.target.value })}
            disabled={salvando}
          >
            <option value="">Selecione um músico</option>
            {contatos.map((contato) => (
              <option key={contato.id} value={contato.id}>
                {contato.name}
              </option>
            ))}
          </Select>
        </Field>

        {/* Função/Instrumento */}
        <Field label="Função/Instrumento">
          <Input
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            placeholder="Ex: Vocal principal, Guitarra, Bateria..."
            disabled={salvando}
          />
        </Field>

        {/* Status */}
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            disabled={salvando}
          >
            <option value="pending">Pendente</option>
            <option value="confirmed">Confirmado</option>
            <option value="declined">Recusado</option>
            <option value="backup">Backup</option>
          </Select>
        </Field>

        {/* Observações */}
        <Field label="Observações (opcional)">
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas internas sobre esta escala..."
            rows={3}
            disabled={salvando}
          />
        </Field>

        {/* Ações */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={salvando}
            className="rounded-[18px] bg-violet-600 px-6 py-3 text-[14px] font-black text-white transition hover:bg-violet-700 disabled:bg-slate-300"
          >
            {salvando ? 'Salvando...' : escalaSelecionada ? 'Atualizar' : 'Criar escala'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={salvando}
              className="rounded-[18px] border border-[#dbe3ef] bg-white px-6 py-3 text-[14px] font-black text-[#0f172a] transition hover:bg-slate-50 disabled:bg-slate-100"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
