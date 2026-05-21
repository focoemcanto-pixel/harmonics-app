'use client';

import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

export default function FreshWorkspaceStartGuide() {
  const router = useRouter();

async function enableOnboardingFlow() {
    try {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token || null;

      const response = await fetch('/api/onboarding/flow-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          flowState: {
            onboarding_enabled: true,
            workspace_created_for_onboarding: true,
          },
        }),
      }).catch(() => null);

      if (!response?.ok) return '/contratos/templates?guide=template';
      const payload = await response.json().catch(() => null);
      return payload?.nextHref || '/contratos/templates?guide=template';
    } catch {
      // O guia manual por query string continua funcionando mesmo se o PATCH falhar.
      return '/contratos/templates?guide=template';
    }
  }

  async function skipGuide() {
    await fetch('/api/onboarding/flow-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowState: { skipped: true, onboarding_skipped: true }, completed: true }),
    }).catch(() => null);
    router.push('/dashboard');
  }

  async function handleStart() {
    const nextHref = await enableOnboardingFlow();
    router.push(nextHref || '/contratos/templates?guide=template');
  }

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-[2px]">
      <section className="w-full max-w-xl rounded-[32px] border border-violet-200 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.38)] md:p-7">
        <div className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-violet-700">
          Guia inicial
        </div>

        <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.05em] text-slate-950 md:text-4xl">
          Bem-vindo ao seu novo workspace
        </h1>

        <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
          Vamos configurar o Harmonics na ordem certa: primeiro o template de contrato, depois o tipo de evento, o pré-contrato e a simulação completa do fluxo.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={skipGuide}
            className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
          >
            Pular guia
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(124,58,237,0.28)] transition hover:bg-violet-500"
          >
            Começar pelo template de contrato
          </button>
        </div>
      </section>
    </div>
  );
}
