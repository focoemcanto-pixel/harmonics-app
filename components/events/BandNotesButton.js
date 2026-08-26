'use client';

import { useEffect, useState } from 'react';
import { NotebookPen, Save, X } from 'lucide-react';

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export default function BandNotesButton({
  eventId,
  eventName,
  eventDate,
  eventTime,
  initialNotes = '',
  initialUpdatedAt = '',
  initialUpdatedBy = '',
  canEdit = false,
  workspaceId = '',
  dark = true,
  compact = false,
  onSaved,
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes || '');
  const [draft, setDraft] = useState(initialNotes || '');
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt || '');
  const [updatedBy, setUpdatedBy] = useState(initialUpdatedBy || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNotes(initialNotes || '');
    setDraft(initialNotes || '');
    setUpdatedAt(initialUpdatedAt || '');
    setUpdatedBy(initialUpdatedBy || '');
  }, [initialNotes, initialUpdatedAt, initialUpdatedBy]);

  const hasNotes = Boolean(String(notes || '').trim());
  if (!canEdit && !hasNotes) return null;

  async function saveNotes() {
    if (!canEdit || !eventId || saving) return;
    try {
      setSaving(true);
      setError('');
      const headers = { 'Content-Type': 'application/json' };
      if (workspaceId) headers['x-workspace-id'] = workspaceId;
      const response = await fetch(`/api/events/${eventId}/band-notes`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ notes: draft }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Não foi possível salvar as instruções.');
      }
      const nextNotes = payload?.event?.band_notes || '';
      setNotes(nextNotes);
      setDraft(nextNotes);
      setUpdatedAt(payload?.event?.band_notes_updated_at || '');
      setUpdatedBy(payload?.event?.band_notes_updated_by || '');
      onSaved?.(payload?.event || {});
    } catch (err) {
      setError(err?.message || 'Não foi possível salvar as instruções.');
    } finally {
      setSaving(false);
    }
  }

  const buttonClass = dark
    ? `relative flex ${compact ? 'h-11 w-11' : 'h-12 w-12'} items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/12 text-violet-100 shadow-[0_12px_30px_rgba(124,58,237,.18)] backdrop-blur transition active:scale-95`
    : `relative flex ${compact ? 'h-11 w-11' : 'h-12 w-12'} items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-700 shadow-sm transition hover:bg-violet-100 active:scale-95`;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDraft(notes || '');
          setError('');
          setOpen(true);
        }}
        className={buttonClass}
        aria-label={hasNotes ? 'Abrir instruções da banda' : 'Adicionar instruções da banda'}
        title={hasNotes ? 'Instruções da banda' : 'Adicionar instruções da banda'}
      >
        <NotebookPen size={compact ? 19 : 21} strokeWidth={2.2} />
        {hasNotes ? (
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-current bg-emerald-400" />
        ) : null}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[260] flex items-end justify-center bg-black/70 p-0 backdrop-blur-[5px] md:items-center md:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[30px] border border-amber-200/20 bg-[#fffaf0] text-[#2f2518] shadow-[0_30px_100px_rgba(0,0,0,.45)] md:rounded-[30px]">
            <div className="relative border-b border-amber-200/60 bg-[linear-gradient(135deg,#fff7d6,#fffaf0)] px-5 pb-5 pt-6 md:px-7">
              <div className="absolute left-0 top-0 h-full w-1.5 bg-amber-400" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
                    <NotebookPen size={14} /> Nota da banda
                  </div>
                  <h3 className="mt-3 text-[24px] font-black tracking-[-0.04em] text-[#2b2116]">
                    Instruções do evento
                  </h3>
                  <p className="mt-1 text-[13px] font-semibold text-[#806f58]">
                    {eventName || 'Evento'}{eventDate ? ` • ${eventDate}` : ''}{eventTime ? ` • ${String(eventTime).slice(0, 5)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-white/75 text-[#66543d]"
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">
              {canEdit ? (
                <>
                  <div className="rounded-[22px] border border-amber-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(120,90,40,.06)]">
                    <label className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-700">
                      O que a banda precisa saber
                    </label>
                    <p className="mt-1 text-[12px] leading-5 text-[#8a7862]">
                      Use linhas curtas para chegada, dinâmica, entradas, versões, roupas, equipamentos ou qualquer orientação importante do dia.
                    </p>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={8000}
                      rows={10}
                      placeholder={'Ex.:\n• Chegar 30 min antes para passagem de som\n• Entrada da noiva: aguardar sinal do cerimonial\n• Música X: versão acústica do link do repertório\n• Traje: social preto'}
                      className="mt-4 min-h-[240px] w-full resize-y rounded-[18px] border border-amber-200 bg-[#fffdf8] px-4 py-4 text-[15px] font-medium leading-7 text-[#34291c] outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-200/30"
                    />
                    <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-[#9b8a73]">
                      <span>Visível para os membros que acessarem este evento.</span>
                      <span>{draft.length}/8000</span>
                    </div>
                  </div>
                  {error ? (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">
                      {error}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-[24px] border border-amber-200/80 bg-white px-5 py-5 shadow-[0_12px_35px_rgba(120,90,40,.07)]">
                  <div className="whitespace-pre-wrap text-[15px] font-semibold leading-8 text-[#3d3122]">
                    {notes}
                  </div>
                </div>
              )}

              {(updatedAt || updatedBy) ? (
                <div className="mt-4 text-[11px] font-semibold text-[#9b8a73]">
                  {updatedAt ? `Atualizada em ${formatDateTime(updatedAt)}` : ''}
                  {updatedAt && updatedBy ? ' • ' : ''}
                  {updatedBy ? `por ${updatedBy}` : ''}
                </div>
              ) : null}
            </div>

            {canEdit ? (
              <div className="border-t border-amber-200/60 bg-[#fff8e8] px-5 py-4 md:px-7">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-[16px] border border-amber-200 bg-white px-4 py-3 text-[14px] font-black text-[#66543d]"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={saveNotes}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 rounded-[16px] bg-[#2f2518] px-4 py-3 text-[14px] font-black text-white shadow-[0_12px_25px_rgba(47,37,24,.18)] disabled:opacity-60"
                  >
                    <Save size={17} /> {saving ? 'Salvando...' : 'Salvar nota'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
