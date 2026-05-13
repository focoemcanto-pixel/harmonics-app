'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

export default function DashboardOnboardingBanner() {
  const supabase = useMemo(() => getSupabase(), []);
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

      const response = await fetch('/api/onboarding/progress', {
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

      const response = await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ skipOnboarding: true }),
      });

      if (response.ok) setHidden(true);
    } finally {
      setSkipping(false);
    }
  }

  useEffect(() => {
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
  }, []);

  if (loading || hidden) return null;
  if (!payload?.showOnboarding) return null;

  const summary = payload.summary || { completed: 0, total: 8, percentage: 0 };
  const progress = payload.progress || {};
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  const missingSteps = steps.filter((step) => progress?.[step.key] !== true).slice(0, 3);
  const nextStep = missingSteps[0];

  return (
    <section data-onboarding-tour="dashboard-banner" className="rounded-[30px] border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 p-5 shadow-[0_14px_34px_rgba(124,58,237,0.10)] md:p-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
        <div>
          <div className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-700">
            Onboarding
          </div>

          <h2 className="mt-3 text-[24px] font-black tracking-[-0.04em] text-[#0f172a] md:text-[30px]">
            Finalize a configuração do seu workspace
          </h2>

          <p className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
            Você concluiu {summary.completed} de {summary.total} etapas. Continue o checklist inicial ou pule essa etapa se preferir configurar manualmente.
          </p>

          {missingSteps.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {missingSteps.map((step) => (
                <span key={step.key} className="rounded-full border border-violet-200 bg-white px-3 py-1 text-[12px] font-black text-violet-700">
                  {step.title}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-violet-200 bg-white p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-violet-700">Configuração inicial</div>
              <div className="mt-1 text-[34px] font-black tracking-[-0.06em] text-violet-950">{summary.percentage}%</div>
            </div>
            <div className="pb-2 text-[13px] font-black text-violet-700">{summary.completed}/{summary.total}</div>
          </div>

          <div className="mt-2 h-3 overflow-hidden rounded-full bg-violet-100">
            <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${summary.percentage || 0}%` }} />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Link href={nextStep?.href || '/settings/onboarding'} className="rounded-2xl bg-violet-600 px-4 py-3 text-center text-[13px] font-black text-white hover:bg-violet-500">
              Continuar
            </Link>
            <button type="button" onClick={skipOnboarding} disabled={skipping} className="rounded-2xl border border-violet-200 bg-white px-4 py-3 text-center text-[13px] font-black text-violet-700 hover:bg-violet-50 disabled:opacity-60">
              {skipping ? 'Pulando...' : 'Pular'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
