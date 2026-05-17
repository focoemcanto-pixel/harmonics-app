'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useHasActiveGuide } from '@/contexts/OnboardingSessionContext';

const PRIORITY_STYLES = {
  critical: {
    badge: 'border-rose-200 bg-rose-100 text-rose-700',
    button: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  high: {
    badge: 'border-orange-200 bg-orange-100 text-orange-700',
    button: 'bg-orange-600 hover:bg-orange-700 text-white',
  },
  medium: {
    badge: 'border-violet-200 bg-violet-100 text-violet-700',
    button: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  low: {
    badge: 'border-blue-200 bg-blue-100 text-blue-700',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  success: {
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
};

export default function WorkspaceRecommendationsFeed({ limit = 3 }) {
  const isGuideActive = useHasActiveGuide();
  const supabase = useMemo(() => getSupabase(), []);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGuideActive) {
      setRecommendations([]);
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function loadRecommendations() {
      try {
        setLoading(true);

        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;

        if (!token) {
          if (active) setRecommendations([]);
          return;
        }

        const response = await fetch('/api/workspace/recommendations', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || 'Erro ao carregar recomendações');
        }

        if (active) {
          setRecommendations((payload.recommendations || []).slice(0, limit));
        }
      } catch (error) {
        console.warn('[WORKSPACE_RECOMMENDATIONS_FEED]', error?.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadRecommendations();

    return () => {
      active = false;
    };
  }, [isGuideActive, limit, supabase]);

  if (isGuideActive) return null;

  if (loading) {
    return (
      <section className="space-y-3">
        {[0, 1].map((item) => (
          <div key={item} className="h-[140px] animate-pulse rounded-[28px] bg-slate-100" />
        ))}
      </section>
    );
  }

  if (!recommendations.length) return null;

  return (
    <section className="space-y-4">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
          Recomendações inteligentes
        </div>

        <h2 className="mt-1 text-[26px] font-black tracking-[-0.05em] text-[#0f172a]">
          Próximas ações recomendadas
        </h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {recommendations.map((recommendation) => {
          const styles = PRIORITY_STYLES[recommendation.priority] || PRIORITY_STYLES.medium;

          return (
            <article
              key={recommendation.id}
              className="overflow-hidden rounded-[30px] border border-[#dbe3ef] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
            >
              <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${styles.badge}`}>
                {recommendation.priority}
              </div>

              <h3 className="mt-4 text-[20px] font-black tracking-[-0.04em] text-[#0f172a]">
                {recommendation.title}
              </h3>

              <p className="mt-3 text-[14px] font-semibold leading-7 text-[#64748b]">
                {recommendation.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={recommendation.href || '/dashboard'}
                  className={`inline-flex items-center justify-center rounded-[18px] px-5 py-3 text-[14px] font-black shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition ${styles.button}`}
                >
                  {recommendation.actionLabel || 'Abrir'}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
