'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import EventoEscalaTab from '../eventos/EventoEscalaTab';

const scaleCache = new Map();

function StatusBadge({ status }) {
  const normalized = String(status || 'pending').toLowerCase();
  const tones = {
    confirmed: 'bg-emerald-500/12 text-emerald-300 border-emerald-400/20',
    pending: 'bg-amber-500/12 text-amber-300 border-amber-400/20',
    declined: 'bg-red-500/12 text-red-300 border-red-400/20',
    backup: 'bg-sky-500/12 text-sky-300 border-sky-400/20',
  };
  const labels = { confirmed: 'Confirmado', pending: 'Pendente', declined: 'Recusado', backup: 'Reserva' };
  return <span className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${tones[normalized] || tones.pending}`}>{labels[normalized] || 'Pendente'}</span>;
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  return (parts[0] || 'M').slice(0, 2).toUpperCase();
}

function getScaleMemberName(member) {
  return member?.contact?.full_name || member?.contact?.name || member?.full_name || member?.name || member?.musician_name || member?.snapshot_name || member?.notes || 'Membro';
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = `55${digits}`;
  return digits;
}

function buildWhatsAppMessage(item, eventTitle) {
  const name = getScaleMemberName(item).split(/\s+/)[0] || 'Oi';
  const role = String(item?.role || item?.suggested_role_name || item?.contact_tag_text || '').trim();
  const status = String(item?.status || 'pending').toLowerCase();
  const platformUrl = typeof window !== 'undefined' ? `${window.location.origin}/membro` : '';
  const eventLine = `Evento: ${eventTitle || 'evento da Harmonics'}${role ? `\nFunção: ${role}` : ''}`;

  if (status === 'confirmed') {
    return `Oi, ${name}! Passando para lembrar da sua escala na Harmonics. 🎶\n\n${eventLine}\n\nSua presença está confirmada. Você pode conferir os detalhes, repertório e informações do evento aqui:\n${platformUrl}`;
  }

  if (status === 'pending') {
    return `Oi, ${name}! Sua escala na Harmonics ainda está pendente de resposta. 🎶\n\n${eventLine}\n\nPor favor, acesse a plataforma para confirmar. Se não puder participar, recuse por lá para conseguirmos ajustar a equipe:\n${platformUrl}`;
  }

  return `Oi, ${name}! Estou entrando em contato sobre esta escala da Harmonics. 🎶\n\n${eventLine}\n\nConfira os detalhes na plataforma:\n${platformUrl}`;
}

function MusicianRow({ item, eventTitle }) {
  const memberName = getScaleMemberName(item);
  const phone = normalizePhone(item?.musician_phone || item?.phone || item?.contact?.phone);

  function openWhatsApp() {
    if (!phone || typeof window === 'undefined') return;
    const message = encodeURIComponent(buildWhatsAppMessage(item, eventTitle));
    window.location.href = `https://wa.me/${phone}?text=${message}`;
  }

  return (
    <div className="rounded-[16px] border border-white/10 bg-[#1e1535] px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#a78bfa)] text-[13px] font-black text-white">{getInitials(memberName)}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-extrabold text-white">{memberName}</div>
          <div className="mt-0.5 truncate text-[12px] font-semibold text-white/65">{item?.role || item?.suggested_role_name || item?.contact_tag_text || '-'}</div>
          {(item?.musician_phone || item?.phone || item?.musician_email || item?.email) ? <div className="mt-1 break-words text-[12px] leading-5 text-white/40">{[item?.musician_phone || item?.phone || '', item?.musician_email || item?.email || ''].filter(Boolean).join(' • ')}</div> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={item?.status} />
          {phone ? <button type="button" onClick={openWhatsApp} aria-label={`Abrir WhatsApp de ${memberName}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-[17px] transition active:scale-95">💬</button> : null}
        </div>
      </div>
    </div>
  );
}

export default function MembroEscalaModal({ open, eventTitle, musicians = [], onClose }) {
  const cached = scaleCache.get(String(eventTitle || '').trim()) || null;
  const [fallbackMusicians, setFallbackMusicians] = useState(() => cached?.musicians || []);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState('');
  const [resolvedEvent, setResolvedEvent] = useState(() => cached?.event || null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasRefreshedScale, setHasRefreshedScale] = useState(false);

  const displayedMusicians = useMemo(() => {
    if (hasRefreshedScale) return fallbackMusicians;
    if (Array.isArray(musicians) && musicians.length > 0) return musicians;
    return fallbackMusicians;
  }, [musicians, fallbackMusicians, hasRefreshedScale]);
  const hasScale = displayedMusicians.length > 0;

  useEffect(() => {
    if (!open) {
      setFallbackError('');
      setFallbackLoading(false);
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
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        if (!cancelled) setIsAdmin(['admin', 'owner'].includes(String(profile?.role || '').toLowerCase()));
      } finally { if (!cancelled) setAdminChecked(true); }
    }
    checkAdmin();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
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

    const cachedScale = scaleCache.get(clientName);
    if (cachedScale && refreshKey === 0) {
      setResolvedEvent(cachedScale.event || null);
      setFallbackMusicians(Array.isArray(cachedScale.musicians) ? cachedScale.musicians : []);
      return undefined;
    }

    let cancelled = false;
    async function loadScale() {
      try {
        setFallbackLoading(!hasScale);
        setFallbackError('');
        const response = await fetch(`/api/membro/escala/by-client?clientName=${encodeURIComponent(clientName)}`, { method: 'GET', cache: 'no-store' });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) throw new Error(result?.error || 'Não foi possível carregar a escala salva.');
        if (!cancelled) {
          const nextMusicians = Array.isArray(result?.musicians) ? result.musicians : [];
          setResolvedEvent(result?.event || null);
          setFallbackMusicians(nextMusicians);
          scaleCache.set(clientName, { event: result?.event || null, musicians: nextMusicians, cachedAt: Date.now() });
          if (refreshKey > 0) setHasRefreshedScale(true);
        }
      } catch (error) {
        if (!cancelled) setFallbackError(error?.message || 'Não foi possível carregar a escala salva.');
      } finally { if (!cancelled) setFallbackLoading(false); }
    }
    loadScale();
    return () => { cancelled = true; };
  }, [open, eventTitle, refreshKey]);

  useEffect(() => {
    if (!open || !Array.isArray(musicians) || musicians.length === 0) return;
    const clientName = String(eventTitle || '').trim();
    if (!clientName) return;
    const previous = scaleCache.get(clientName) || {};
    scaleCache.set(clientName, { ...previous, musicians, cachedAt: Date.now() });
  }, [open, eventTitle, musicians]);

  if (!open) return null;
  function handleBackdropClick(e) { if (e.target === e.currentTarget) onClose?.(); }
  function closeBuilderAndRefresh() { setBuilderOpen(false); scaleCache.delete(String(eventTitle || '').trim()); setRefreshKey((value) => value + 1); }

  return (
    <>
      <div className="fixed inset-0 z-[180] bg-black/70 backdrop-blur-[4px]" onClick={handleBackdropClick}>
        <div className="flex h-[100dvh] items-end justify-center overflow-hidden px-0 pt-[env(safe-area-inset-top,0px)]">
          <div className="flex h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] w-full max-w-[500px] flex-col overflow-hidden rounded-t-[22px] border border-white/10 bg-[#1a1230] text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)] md:my-6 md:h-auto md:max-h-[88vh] md:rounded-[20px]" onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0">
              <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-white/15" />
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#1a1230] px-5 py-4">
                <div className="min-w-0 flex-1"><div className="text-[18px] font-black tracking-[-0.03em] text-white">👥 Escala</div><div className="mt-1 truncate text-[12px] font-semibold text-white/55">{eventTitle || 'Evento'}</div></div>
                <div className="flex items-center gap-2">
                  {adminChecked && isAdmin && resolvedEvent?.id ? <button type="button" onClick={() => setBuilderOpen(true)} className="rounded-[12px] border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-[11px] font-black text-violet-200 transition active:scale-[0.98]">{hasScale ? 'Editar' : 'Montar'}</button> : null}
                  <button type="button" aria-label="Fechar escala" onClick={onClose} className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-[12px] border border-white/10 bg-[#241b3d] px-3 py-2 text-[13px] font-extrabold text-white transition active:scale-[0.98]">✕</button>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-4 [-webkit-overflow-scrolling:touch]">
              {fallbackLoading && !hasScale ? <div className="space-y-2">{[0,1,2].map((key) => <div key={key} className="h-[92px] animate-pulse rounded-[16px] border border-white/10 bg-white/5" />)}</div> : !hasScale ? <div className="rounded-[16px] border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center"><div className="text-[14px] font-semibold text-white/70">Sem escala montada até o momento.</div><div className="mt-1 text-[12px] font-medium text-white/50">{fallbackError || 'A escala deste evento ainda não foi definida pela administração.'}</div></div> : <div className="space-y-2">{displayedMusicians.map((item, index) => <MusicianRow key={`${item?.id || item?.musician_id || index}`} item={item} eventTitle={eventTitle} />)}</div>}
            </div>
          </div>
        </div>
      </div>
      {builderOpen && resolvedEvent?.id ? <div className="fixed inset-0 z-[220] bg-[#080411]/95 backdrop-blur-md"><div className="flex h-[100dvh] flex-col overflow-hidden"><div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#120a22] px-4 py-3 text-white"><div className="min-w-0"><div className="text-[15px] font-black">Montar escala</div><div className="truncate text-[11px] font-semibold text-white/50">{eventTitle || 'Evento'}</div></div><button type="button" onClick={closeBuilderAndRefresh} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-black">Concluir</button></div><div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f4fb] px-2 py-3 md:px-5"><EventoEscalaTab eventId={resolvedEvent.id} /></div></div></div> : null}
    </>
  );
}
