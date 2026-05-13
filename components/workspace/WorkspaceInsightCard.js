'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { getWorkspaceInsight } from '@/lib/workspace-events/getWorkspaceInsight';

const PRIORITY_STYLES = {
  high: {
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
    button: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  medium: {
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
    button: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  low: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  success: {
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
};

export default function WorkspaceInsightCard() {
  const supabase = useMemo(() => getSupabase(), []);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadInsight() {
      try {
        setLoading(true);

        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;

        if (!token) {
          if (active) setInsight(null);
          return;
        }

        const response = await fetch('/api/workspace/activity?limit=100', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || 'Erro ao carregar atividades');
        }

        const nextInsight = getWorkspaceInsight(payload.timeline || []);

        if (active) {
          setInsight(nextInsight);
        }
      } catch (error) {
        console.warn('[WORKSPACE_INSIGHT_CARD]', error?.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInsight();

    return () => {
      active = false;
    };
  }, [supabase]);

  if (loading) {
    return (
      <section className="animate-pulse rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_14px_38px_rgba(15,23,42,0.06)]">
        <div className="h-4 w-32 rounded-full bg-slate-200" />
        <div className="mt-4 h-8 w-3/4 rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-full rounded-full bg-slate-100" />
        <div className="mt-2 h-4 w-5/6 rounded-full bg-slate-100" />
        <div className="mt-5 h-11 w-44 rounded-2xl bg-slate-200" />
      </section>
    );
  }

  if (!insight) return null;

  const styles = PRIORITY_STYLES[insight.priority] || PRIORITY_STYLES.medium;

  return (
    <section className="overflow-hidden rounded-[32px] border border-[#dbe3ef] bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.08),transparent_38%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-[0_14px_38px_rgba(15,23,42,0.06)]">
      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${styles.badge}`}>
        {insight.eyebrow}
      </div>

      <h2 className="mt-4 max-w-2xl text-[28px] font-black tracking-[-0.05em] text-[#0f172a]">
        {insight.title}
      </h2>

      <p className="mt-3 max-w-2xl text-[14px] font-semibold leading-7 text-[#64748b]">
        {insight.description}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={insight.href || '/dashboard'}
          className={`inline-flex items-center justify-center rounded-[18px] px-5 py-3 text-[14px] font-black shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition ${styles.button}`}
        >
          {insight.cta}
        </Link>
      </div>
    </section>
  );
}
