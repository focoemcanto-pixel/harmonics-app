'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { ONBOARDING_STEPS } from '@/lib/onboarding/tourRegistry';

const fallbackSummary = {
  total: ONBOARDING_STEPS.length,
  completed: 0,
  percentage: 0,
};

export default function OnboardingChecklistClient() {
  const supabase = useMemo(() => getSupabase(), []);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(fallbackSummary);
  const [error, setError] = useState('');

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function loadProgress() {
    setLoading(true);
    setError('');

    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const response = await fetch('/api/onboarding/progress', {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Não foi possível carregar o onboarding.');
      }

      setProgress(payload.progress || {});
      setSummary(payload.summary || fallbackSummary);
    } catch (err) {
      setError(err?.message || 'Erro ao carregar onboarding.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleStep(stepKey, completed) {
    setSavingKey(stepKey);
    setError('');

    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const response = await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stepKey, completed }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Não foi possível atualizar a etapa.');
      }

      setProgress(payload.progress || {});
      setSummary(payload.summary || fallbackSummary);
    } catch (err) {
      setError(err?.message || 'Erro ao atualizar etapa.');
    } finally {
      setSavingKey('');
    }
  }

  useEffect(() => {
    loadProgress();
  }, []);

  const nextStep = ONBOARDING_STEPS.find((step) => progress?.[step.key] !== true) || null;

  if (loading) {
    return (
      <section className="rounded-[30px] border border-[#dbe3ef] bg-white p-8 text-[#64748b] shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        Carregando checklist de onboarding...
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <section className="rounded-[22px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[34px] border border-[#dbe3ef] bg-white shadow-[0_18px_46px_rgba(15,23,42,0.06)]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_0.86fr] lg:p-8">
          <div>
            <div className="inline-flex rounded-full bg-violet-100 px-4 py-2 text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">
              Onboarding do workspace
            </div>

            <h1 className="mt-5 max-w-3xl text-[38px] font-black leading-[0.95] tracking-[-0.06em] text-[#0f172a] md:text-[56px]">
              Configure sua operação passo a passo.
            </h1>

            <p className="mt-5 max-w-2xl text-[16px] font-semibold leading-8 text-[#64748b]">
              Este guia acompanha o estado real do workspace e orienta a primeira configuração: identidade, modelo, tipos, pré-contrato, evento, automações e equipe.
            </p>

            {nextStep ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={nextStep.href} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(124,58,237,0.24)] transition hover:bg-violet-500">
                  Continuar: {nextStep.cta}
                </Link>
                <button type="button" onClick={loadProgress} className="rounded-2xl border border-[#dbe3ef] bg-white px-5 py-3 text-sm font-black text-[#0f172a] transition hover:bg-slate-50">
                  Atualizar progresso
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-800">
                🎉 Onboarding concluído. Seu workspace já tem a base operacional pronta.
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-violet-200 bg-violet-50 p-6">
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">
              Progresso geral
            </div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="text-[54px] font-black tracking-[-0.07em] text-violet-950">
                {summary.percentage}%
              </div>
              <div className="pb-2 text-[14px] font-black text-violet-800">
                {summary.completed}/{summary.total} etapas
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-violet-100">
              <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${summary.percentage || 0}%` }} />
            </div>
            <p className="mt-5 text-[13px] font-semibold leading-6 text-violet-800">
              As etapas podem ser marcadas manualmente agora. Na próxima camada, o Harmonics marcará automaticamente quando detectar ações reais no sistema.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {ONBOARDING_STEPS.map((step, index) => {
          const done = progress?.[step.key] === true;
          const saving = savingKey === step.key;

          return (
            <article key={step.key} className={`rounded-[28px] border bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)] transition ${done ? 'border-emerald-200 bg-emerald-50/40' : 'border-[#dbe3ef]'}`}>
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => toggleStep(step.key, !done)}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black transition ${done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-700'}`}
                  aria-label={done ? 'Marcar como pendente' : 'Marcar como concluída'}
                >
                  {saving ? '...' : done ? '✓' : index + 1}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[18px] font-black tracking-[-0.03em] text-[#0f172a]">{step.title}</h2>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {done ? 'Concluído' : 'Pendente'}
                    </span>
                  </div>

                  <p className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">{step.description}</p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={step.href} className="rounded-2xl bg-white px-4 py-2 text-[13px] font-black text-violet-700 ring-1 ring-violet-200 transition hover:bg-violet-50">
                      {step.cta}
                    </Link>
                    <button type="button" disabled={saving} onClick={() => toggleStep(step.key, !done)} className="rounded-2xl border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#475569] transition hover:bg-slate-50 disabled:opacity-60">
                      {done ? 'Reabrir etapa' : 'Marcar como feito'}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
