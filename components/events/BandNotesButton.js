'use client';

import { useEffect, useRef, useState } from 'react';
import { NotebookPen, Save, X } from 'lucide-react';

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export default function BandNotesButton({ eventId, eventName, eventDate, eventTime, initialNotes = '', initialUpdatedAt = '', initialUpdatedBy = '', canEdit = false, workspaceId = '', dark = true, compact = false, onSaved }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes || '');
  const [draft, setDraft] = useState(initialNotes || '');
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt || '');
  const [updatedBy, setUpdatedBy] = useState(initialUpdatedBy || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragY, setDragY] = useState(0);
  const touchStart = useRef(null);

  useEffect(() => { setNotes(initialNotes || ''); setDraft(initialNotes || ''); setUpdatedAt(initialUpdatedAt || ''); setUpdatedBy(initialUpdatedBy || ''); }, [initialNotes, initialUpdatedAt, initialUpdatedBy]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const hasNotes = Boolean(String(notes || '').trim());
  if (!canEdit && !hasNotes) return null;

  function closeSheet() { setDragY(0); setOpen(false); }
  function onTouchStart(e) { touchStart.current = e.touches?.[0]?.clientY ?? null; }
  function onTouchMove(e) {
    if (touchStart.current == null) return;
    const delta = (e.touches?.[0]?.clientY ?? touchStart.current) - touchStart.current;
    if (delta > 0) setDragY(Math.min(delta, 220));
  }
  function onTouchEnd() {
    if (dragY > 90) closeSheet();
    else setDragY(0);
    touchStart.current = null;
  }

  async function saveNotes() {
    if (!canEdit || !eventId || saving) return;
    try {
      setSaving(true); setError('');
      const headers = { 'Content-Type': 'application/json' };
      if (workspaceId) headers['x-workspace-id'] = workspaceId;
      const response = await fetch(`/api/events/${eventId}/band-notes`, { method: 'PATCH', headers, body: JSON.stringify({ notes: draft }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Não foi possível salvar as instruções.');
      const nextNotes = payload?.event?.band_notes || '';
      setNotes(nextNotes); setDraft(nextNotes);
      setUpdatedAt(payload?.event?.band_notes_updated_at || ''); setUpdatedBy(payload?.event?.band_notes_updated_by || '');
      onSaved?.(payload?.event || {});
    } catch (err) { setError(err?.message || 'Não foi possível salvar as instruções.'); }
    finally { setSaving(false); }
  }

  const buttonClass = dark
    ? `relative flex ${compact ? 'h-11 w-11' : 'h-12 w-12'} items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-500/12 text-violet-100 shadow-[0_12px_30px_rgba(124,58,237,.18)] backdrop-blur transition active:scale-95`
    : `relative flex ${compact ? 'h-11 w-11' : 'h-12 w-12'} items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-700 shadow-sm transition hover:bg-violet-100 active:scale-95`;

  return <>
    <button type="button" onClick={(e) => { e.stopPropagation(); setDraft(notes || ''); setError(''); setOpen(true); }} className={buttonClass} aria-label={hasNotes ? 'Abrir instruções da banda' : 'Adicionar instruções da banda'} title="Nota da banda">
      <NotebookPen size={compact ? 19 : 21} strokeWidth={2.2} />
      {hasNotes ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-current bg-emerald-400" /> : null}
    </button>

    {open ? <div className="fixed inset-0 z-[9999] bg-black/55 backdrop-blur-sm md:flex md:items-center md:justify-center md:p-6" onClick={(e) => { if (e.target === e.currentTarget) closeSheet(); }}>
      <section
        className="absolute inset-x-0 bottom-0 flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-[#fffaf0] text-[#2f2518] shadow-[0_-25px_80px_rgba(0,0,0,.5)] transition-transform duration-200 ease-out md:static md:h-auto md:max-h-[90dvh] md:max-w-2xl md:rounded-[30px]"
        style={{ transform: `translateY(${dragY}px)` }}
      >
        <div className="shrink-0 bg-[linear-gradient(135deg,#fff7d6,#fffaf0)] px-5 pb-5 pt-2 md:px-7 md:pt-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-amber-900/20 md:hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
          <div className="flex items-start justify-between gap-4" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800"><NotebookPen size={14}/> Nota da banda</div>
              <h3 className="mt-3 text-[24px] font-black tracking-[-0.04em]">Instruções do evento</h3>
              <p className="mt-1 truncate text-[13px] font-semibold text-[#806f58]">{eventName || 'Evento'}{eventDate ? ` • ${eventDate}` : ''}{eventTime ? ` • ${String(eventTime).slice(0,5)}` : ''}</p>
            </div>
            <button type="button" onClick={closeSheet} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-white/80 text-[#66543d]" aria-label="Fechar"><X size={20}/></button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-y border-amber-200/60 px-5 py-5 md:px-7 md:py-6">
          {canEdit ? <>
            <div className="rounded-[22px] border border-amber-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(120,90,40,.06)]">
              <label className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-700">O que a banda precisa saber</label>
              <p className="mt-1 text-[12px] leading-5 text-[#8a7862]">Orientações importantes para este evento: chegada, dinâmica, entradas, versões, roupas e equipamentos.</p>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={8000} placeholder={'Ex.:\n• Chegar 30 min antes para passagem de som\n• Entrada da noiva: aguardar sinal do cerimonial\n• Traje: social preto'} className="mt-4 min-h-[46dvh] w-full resize-none rounded-[18px] border border-amber-200 bg-[#fffdf8] px-4 py-4 text-[15px] font-medium leading-7 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-200/30 md:min-h-[280px]" />
              <div className="mt-2 flex justify-between text-[11px] font-semibold text-[#9b8a73]"><span>Visível para a banda.</span><span>{draft.length}/8000</span></div>
            </div>
            {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">{error}</div> : null}
          </> : <div className="rounded-[24px] border border-amber-200/80 bg-white px-5 py-5 shadow-sm"><div className="whitespace-pre-wrap text-[15px] font-semibold leading-8">{notes}</div></div>}
          {(updatedAt || updatedBy) ? <div className="mt-4 text-[11px] font-semibold text-[#9b8a73]">{updatedAt ? `Atualizada em ${formatDateTime(updatedAt)}` : ''}{updatedAt && updatedBy ? ' • ' : ''}{updatedBy ? `por ${updatedBy}` : ''}</div> : null}
        </div>

        <div className="shrink-0 bg-[#fff8e8] px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4 md:px-7">
          {canEdit ? <div className="grid grid-cols-2 gap-3"><button type="button" onClick={closeSheet} className="rounded-[16px] border border-amber-200 bg-white px-4 py-3 text-[14px] font-black text-[#66543d]">Fechar</button><button type="button" onClick={saveNotes} disabled={saving} className="flex items-center justify-center gap-2 rounded-[16px] bg-[#2f2518] px-4 py-3 text-[14px] font-black text-white disabled:opacity-60"><Save size={17}/>{saving ? 'Salvando...' : 'Salvar nota'}</button></div> : <button type="button" onClick={closeSheet} className="w-full rounded-[16px] bg-[#2f2518] px-4 py-3 text-[14px] font-black text-white">Voltar para agenda</button>}
        </div>
      </section>
    </div> : null}
  </>;
}
