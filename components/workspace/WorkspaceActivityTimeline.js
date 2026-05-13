'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

const TONE_CLASSES = {
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

export default function WorkspaceActivityTimeline({ limit = 8, compact = false }) {
  const supabase = useMemo(() => getSupabase(), []);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadTimeline() {
      try {
        setLoading(true);
        setError('');

        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) {
          if (active) setTimeline([]);
          return;
        }

        const response = await fetch(`/api/workspace/activity?limit=${limit}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || 'Erro ao carregar atividades.');
        }

        if (active) setTimeline(Array.isArray(payload.timeline) ? payload.timeline : []);
      } catch (loadError) {
        if (active) setError(loadError?.message || 'Erro ao carregar atividades.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTimeline();

    return () => {
      active = false;
    };
  }, [limit, supabase]);

  return (
    <section className="rounded-[30px] border border-[#dbe3ef] bg-white p-5 shadow-[0_14px_38px_rgba(15,23,42,0.06)] md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
            Workspace vivo
          </div>
          <h2 className="mt-1 text-[22px] font-black tracking-[-0.04em] text-[#0f172a]">
            Atividades recentes
          </h2>
          {!compact ? (
            <p className="mt-2 text-[13px] font-semibold leading-6 text-[#64748b]">
              Acompanhe os principais marcos operacionais registrados neste workspace.
            </p>
          ) : null}
        </div>

        <div className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black text-violet-700">
          {timeline.length || 0} eventos
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-[72px] animate-pulse rounded-[22px] bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[13px] font-semibold text-rose-700">
            {error}
          </div>
        ) : timeline.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-violet-200 bg-violet-50/50 px-5 py-6 text-center">
            <div className="text-[28px]">✨</div>
            <h3 className="mt-2 text-[16px] font-black text-[#0f172a]">Nenhuma atividade registrada ainda</h3>
            <p className="mx-auto mt-2 max-w-md text-[13px] font-semibold leading-6 text-[#64748b]">
              Quando você criar templates, canais, pré-contratos ou eventos, eles aparecerão aqui como uma linha do tempo operacional.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {timeline.map((event) => {
              const toneClass = TONE_CLASSES[event.tone] || TONE_CLASSES.slate;
              return (
                <article key={event.id || `${event.type}-${event.createdAt}`} className="flex gap-3 rounded-[24px] border border-[#e2e8f0] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-[20px] ${toneClass}`}>
                    {event.icon || '✨'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-[15px] font-black tracking-[-0.02em] text-[#0f172a]">
                        {event.title}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-[#64748b]">
                        {event.relativeTime}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] font-semibold leading-6 text-[#64748b]">
                      {event.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
