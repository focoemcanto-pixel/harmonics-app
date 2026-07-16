'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import EventoEscalaTab from '../eventos/EventoEscalaTab';

function StatusBadge({ status }) {
  const normalized = String(status || 'pending').toLowerCase();
  const tones = {
    confirmed: 'bg-emerald-500/12 text-emerald-300 border-emerald-400/20',
    pending: 'bg-amber-500/12 text-amber-300 border-amber-400/20',
    declined: 'bg-red-500/12 text-red-300 border-red-400/20',
    backup: 'bg-sky-500/12 text-sky-300 border-sky-400/20',
  };
  const labels = {
    confirmed: 'Confirmado',
    pending: 'Pendente',
    declined: 'Recusado',
    backup: 'Reserva',
  };

  return (
    <span className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tones[normalized] || tones.pending}`}>
      {labels[normalized] || 'Pendente'}
    </span>
  );
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  return (parts[0] || 'M').slice(0, 2).toUpperCase();
}

function getScaleMemberName(member) {
  return member?.contact?.full_name
    || member?.contact?.name
    || member?.full_name
    || member?.name
    || member?.musician_name
    || member?.snapshot_name
    || member?.notes
    || 'Membro';
}

function MusicianRow({ item }) {
  const memberName = getScaleMemberName(item);
  return (
    <div className="rounded-[16px] border border-white/10 bg-[#1e1535] px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#a78bfa)] text-[13px] font-black text-white">
          {getInitials(memberName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-extrabold text-white">{memberName}</div>
          <div className="mt-0.5 truncate text-[12px] font-semibold text-white/65">
            {item?.role || item?.suggested_role_name || item?.contact_tag_text || '-'}
          </div>
          {(item?.musician_phone || item?.phone || item?.musician_email || item?.email) ? (
            <div className="mt-1 break-words text-[12px] leading-5 text-white/40">
              {[item?.musician_phone || item?.phone || '', item?.musician_email || item?.email || ''].filter(Boolean).join(' • ')}
            </div>
          ) : null}
        </div>
        <StatusBadge status={item?.status} />
      </div>
    </div>
  );
}

export default function MembroEscalaModal({ open, eventTitle, musicians = [], onClose }) {
  const [fallbackMusicians, setFallbackMusicians] = useState([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState('');
  const [resolvedEvent, setResolvedEvent] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasRefreshedScale, setHasRefreshedScale] = useState(false);

  const originalMusicians = Array.isArray(musicians) ? musicians : [];
  const safeFallbackMusicians = Array.isArray(fallbackMusicians) ? fallbackMusicians : [];

  const displayedMusicians = useMemo(() => {
    if (hasRefreshedScale) return safeFallbackMusicians;
    if (originalMusicians.length > 0) return originalMusicians;
    return safeFallbackMusicians;
  }, [originalMusicians, safeFallbackMusicians, hasRefreshedScale]);

  const hasScale = originalMusicians.length > 0 || safeFallbackMusicians.length > 0 || displayedMusicians.length > 0;
  const resolvedEventId = useMemo(() => {
    if (resolvedEvent?.id) return resolvedEvent.id;
    const row = [...displayedMusicians, ...originalMusicians, ...safeFallbackMusicians]
      .find((item) => item?.event_id || item?.eventId || item?.events?.id);
    return row?.event_id || row?.eventId || row?.events?.id || null;
  }, [resolvedEvent, displayedMusicians, originalMusicians, safeFallbackMusicians]);

  useEffect(() => {
    if (!open) {
      setFallbackMusicians([]);
      setFallbackError('');
      setFallbackLoading(false);
      setResolvedEvent(null);
      setBuilderOpen(false);
      setHasRefreshedScale(false);
      setAdminChecked(false);
      setIsAdmin(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    async function checkAdmin() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!cancelled) {
          setIsAdmin(['admin', 'owner'].includes(String(profile?.role || '').toLowerCase()));
        }
      } finally {
        if (!cancelled) setAdminChecked(true);
      }
    }

    checkAdmin();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyTouchAction = document.body.style.touchAction;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const clientName = String(eventTitle || '').trim();
    if (!clientName || clientName === 'Escala' || clientName === 'Evento') return undefined;
    if (!isAdmin && originalMusicians.length > 0 && refreshKey === 0) return undefined;

    let cancelled = false;
    async function loadScale() {
      try {
        setFallbackLoading(true);
        setFallbackError('');
        const response = await fetch(`/api/membro/escala/by-client?clientName=${encodeURIComponent(clientName)}`, {
          method: 'GET',
          cache: 'no-store',
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) throw new Error(result?.error || 'Não foi possível carregar a escala salva.');
        if (!cancelled) {
          setResolvedEvent(result?.event || null);
          setFallbackMusicians(Array.isArray(result?.musicians) ? result.musicians : []);
          if (refreshKey > 0) setHasRefreshedScale(true);
        }
      } catch (error) {
        if (!cancelled) {
          setFallbackError(error?.message || 'Não foi possível carregar a escala salva.');
          setFallbackMusicians([]);
        }
      } finally {
        if (!cancelled) setFallbackLoading(false);
      }
    }

    loadScale();
    return () => { cancelled = true; };
  }, [open, eventTitle, isAdmin, refreshKey, originalMusicians.length]);

  if (!open) return null;

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  function closeBuilderAndRefresh() {
    setBuilderOpen(false);
    setRefreshKey((value) => value + 1);
  }

  return (
    <>
      <div className="fixed inset-0 z-[180] bg-black/70 backdrop-blur-[4px]" onClick={handleBackdropClick}>
        <div className="flex h-[100dvh] items-end justify-center overflow-hidden px-0 pt-[env(safe-area-inset-top,0px)]">
          <div className="flex h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] w-full max-w-[500px] flex-col overflow-hidden rounded-t-[22px] border border-white/10 bg-[#1a1230] text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)] md:my-6 md:h-auto md:max-h-[88vh] md:rounded-[20px]" onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0">
              <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-white/15" />
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#1a1230] px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[18px] font-black tracking-[-0.03em] text-white">👥 Escala</div>
                  <div className="mt-1 truncate text-[12px] font-semibold text-white/55">{eventTitle || 'Evento'}</div>
                </div>
                <div className="flex items-center gap-2">
                  {adminChecked && isAdmin && resolvedEventId ? (
                    <button
                      type="button"
                      onClick={() => setBuilderOpen(true)}
                      className="rounded-[12px] border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-[11px] font-black text-violet-200 transition active:scale-[0.98]"
                    >
                      {hasScale ? 'Editar' : 'Montar'}
                    </button>
                  ) : null}
                  <button type="button" aria-label="Fechar escala" onClick={onClose} className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-[12px] border border-white/10 bg-[#241b3d] px-3 py-2 text-[13px] font-extrabold text-white transition active:scale-[0.98]">✕</button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-4 [-webkit-overflow-scrolling:touch]">
              {fallbackLoading && !hasScale ? (
                <div className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-5 text-center">
                  <div className="text-[14px] font-semibold text-white/70">Carregando escala salva...</div>
                  <div className="mt-1 text-[12px] font-medium text-white/50">Buscando músicos confirmados deste evento.</div>
                </div>
              ) : !hasScale ? (
                <div className="rounded-[16px] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center">
                  <div className="text-[14px] font-semibold text-white/70">Sem escala montada até o momento.</div>
                  <div className="mt-1 text-[12px] font-medium text-white/50">{fallbackError || 'A escala deste evento ainda não foi definida pela administração.'}</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedMusicians.map((item, index) => (
                    <MusicianRow key={`${item?.id || item?.musician_id || index}`} item={item} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {builderOpen && resolvedEventId ? (
        <div className="fixed inset-0 z-[220] bg-[#080411]/95 backdrop-blur-md">
          <div className="flex h-[100dvh] flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#120a22] px-4 py-3 text-white">
              <div className="min-w-0">
                <div className="text-[15px] font-black">{hasScale ? 'Editar escala' : 'Montar escala'}</div>
                <div className="truncate text-[11px] font-semibold text-white/50">{eventTitle || 'Evento'}</div>
              </div>
              <button type="button" onClick={closeBuilderAndRefresh} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-black">Concluir</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f4fb] px-2 py-3 md:px-5">
              <EventoEscalaTab eventId={resolvedEventId} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
