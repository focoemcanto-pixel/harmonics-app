'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

const STATUS_STYLES = {
  initial: {
    ring: 'from-slate-400 to-slate-500',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  setup: {
    ring: 'from-amber-400 to-orange-500',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  progressing: {
    ring: 'from-violet-500 to-fuchsia-500',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  healthy: {
    ring: 'from-emerald-400 to-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
};

export default function WorkspaceHealthCard() {
  const supabase = useMemo(() => getSupabase(), []);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadHealth() {
      try {
        setLoading(true);

        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;

        if (!token) {
          if (active) setHealth(null);
          return;
        }

        const response = await fetch('/api/workspace/health', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || 'Erro ao carregar saúde do workspace');
        }

        if (active) {
          setHealth(payload.health || null);
        }
      } catch (error) {
        console.warn('[WORKSPACE_HEALTH_CARD]', error?.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHealth();

    return () => {
      active = false;
    };
  }, [supabase]);

  if (loading) {
    return (
      <section className="animate-pulse rounded-[32px] border border-[#dbe3ef] bg-white p-6 shadow-[0_14px_38px_rgba(15,23,42,0.06)]">
        <div className="h-5 w-40 rounded-full bg-slate-200" />
        <div className="mt-5 h-28 rounded-[24px] bg-slate-100" />
      </section>
    );
  }

  if (!health) return null;

  const styles = STATUS_STYLES[health.status] || STATUS_STYLES.initial;

  return (
    <section className="overflow-hidden rounded-[32px] border border-[#dbe3ef] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-[0_14px_38px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
            Saúde operacional
          </div>

          <h2 className="mt-2 text-[28px] font-black tracking-[-0.05em] text-[#0f172a]">
            {health.label}
          </h2>

          <p className="mt-3 max-w-2xl text-[14px] font-semibold leading-7 text-[#64748b]">
            {health.description}
          </p>
        </div>

        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-black ${styles.badge}`}>
          {health.completedChecks}/{health.totalChecks} etapas concluídas
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[240px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-[28px] border border-[#e2e8f0] bg-white p-6 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
          <div className={`flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br ${styles.ring} p-[10px] shadow-[0_18px_34px_rgba(15,23,42,0.12)]`}>
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center">
              <div className="text-[42px] font-black tracking-[-0.06em] text-[#0f172a]">
                {health.score}
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#64748b]">
                score
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {health.checks?.map((check) => (
            <div key={check.key} className={`rounded-[22px] border px-4 py-4 ${check.completed ? 'border-emerald-200 bg-emerald-50/70' : 'border-[#e2e8f0] bg-white'}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-black ${check.completed ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {check.completed ? '✓' : '•'}
                </div>

                <div>
                  <div className="text-[14px] font-black text-[#0f172a]">
                    {check.label}
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-[#64748b]">
                    Peso operacional: {check.weight}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
