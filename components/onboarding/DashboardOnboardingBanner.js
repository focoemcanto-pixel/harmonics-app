'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { useHasActiveGuide } from '@/contexts/OnboardingSessionContext';


export default function DashboardOnboardingBanner() {
  const isGuideActive = useHasActiveGuide();
  const supabase = useMemo(() => getSupabase(), []);
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [skipping, setSkipping] = useState(false);
  const [hidden, setHidden] = useState(false);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function loadProgress() {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/onboarding/flow-status', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok) setPayload(data);
    } finally {
      setLoading(false);
    }
  }

  async function skipOnboarding() {
    if (skipping) return;
    setSkipping(true);

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/onboarding/flow-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ flowState: { skipped: true, onboarding_skipped: true } }),
      });

      if (response.ok) setHidden(true);
    } finally {
      setSkipping(false);
    }
  }

  useEffect(() => {
    if (isGuideActive) {
      setPayload(null);
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function run() {
      if (!active) return;
      await loadProgress();
    }

    run();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuideActive]);

  if (isGuideActive || loading || hidden) return null;
  if (!payload?.ok) return null;
  if (payload.completed === true || payload.skipped === true || payload.primaryWorkspace === true) return null;

  const checklist = Array.isArray(payload.checklist) ? payload.checklist : [];
  if (checklist.length === 0) return null;

  const doneCount = checklist.filter((item) => item.done).length;
  const percentage = Math.round((doneCount / checklist.length) * 100);
  const nextItem = checklist.find((item) => !item.done) || null;
  const justFinishedEssentials = searchParams?.get('onboarding') === 'ready';

  return (
    <section data-onboarding-tour="dashboard-banner" className="rounded-[30px] border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 p-5 shadow-[0_14px_34px_rgba(124,58,237,0.10)] md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-700">
            Primeiros passos
          </div>
          <h2 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-[#0f172a] md:text-[28px]">
            {justFinishedEssentials ? 'Seu espaço está pronto.' : 'Deixe seu workspace pronto para vender'}
          </h2>
          <p className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
            {justFinishedEssentials
              ? 'Siga os próximos passos no seu ritmo — tudo é salvo automaticamente.'
              : `${doneCount} de ${checklist.length} passos concluídos.`}
          </p>
        </div>
        <div className="flex items-center gap-3 md:flex-col md:items-end">
          <div className="text-[28px] font-black tracking-[-0.06em] text-violet-950">{percentage}%</div>
          <button type="button" onClick={skipOnboarding} disabled={skipping} className="rounded-2xl border border-violet-200 bg-white px-4 py-2 text-[12px] font-black text-violet-700 hover:bg-violet-50 disabled:opacity-60">
            {skipping ? 'Ocultando...' : 'Ocultar checklist'}
          </button>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-100">
        <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${percentage}%` }} />
      </div>

      <ol className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {checklist.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={`flex h-full items-start gap-3 rounded-[20px] border p-4 transition ${
                item.done
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : item.key === nextItem?.key
                    ? 'border-violet-300 bg-white shadow-[0_10px_26px_rgba(124,58,237,0.10)] hover:-translate-y-0.5'
                    : 'border-violet-100 bg-white/80 hover:bg-white'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-black ${
                  item.done ? 'bg-emerald-500 text-white' : 'border border-violet-300 text-violet-700'
                }`}
              >
                {item.done ? '✓' : ''}
              </span>
              <span>
                <span className={`block text-[14px] font-black ${item.done ? 'text-emerald-900' : 'text-[#0f172a]'}`}>{item.title}</span>
                {item.description ? <span className="mt-1 block text-[12px] font-semibold leading-5 text-[#64748b]">{item.description}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
