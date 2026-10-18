'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { WORKSPACE_CACHE_KEY } from '@/hooks/useCurrentWorkspace';
import Link from 'next/link';
import { buildLegalAcceptance } from '@/lib/legal/documents';
import { readIntendedPlan } from '@/lib/billing/intended-plan';
import {
  Alert,
  BrandMark,
  JourneySteps,
  PublicBackground,
  PublicLoading,
  Spinner,
  inputClass,
  labelClass,
  panelClass,
  primaryButtonClass,
} from '@/components/public/PublicUI';
import { usePlanDetails } from '@/components/public/usePlanDetails';

const DEFAULT_COLOR = '#8b5cf6';

const WORKSPACE_STORAGE_PREFIXES = [
  'harmonics:workspace-',
  'harmonics:section-guide:',
  'harmonics:template-guide-stable:',
  'harmonics:event-type-template-guide:',
  'harmonics:precontract-guide:',
];

const WORKSPACE_STORAGE_KEYS = [
  WORKSPACE_CACHE_KEY,
  'harmonics:onboarding-tour:v1',
  'harmonics_pending_signup_bootstrap',
];

function resetWorkspaceScopedStorage(nextWorkspaceId) {
  if (typeof window === 'undefined') return;

  const clearStorage = (storage) => {
    if (!storage) return;

    for (const key of WORKSPACE_STORAGE_KEYS) {
      storage.removeItem(key);
    }

    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (!key) continue;
      if (WORKSPACE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        storage.removeItem(key);
      }
    }
  };

  try {
    clearStorage(window.localStorage);
    clearStorage(window.sessionStorage);

    if (nextWorkspaceId) {
      window.localStorage.setItem(
        WORKSPACE_CACHE_KEY,
        JSON.stringify({ workspaceId: nextWorkspaceId, pendingConfirmation: true })
      );
    }
  } catch {
    // Storage não deve bloquear a criação do workspace nem o redirecionamento limpo.
  }
}

function normalizeHexColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR;
}

export default function NewWorkspacePage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [workspaceName, setWorkspaceName] = useState('');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_COLOR);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [intendedPlan, setIntendedPlan] = useState('');
  const { name: planName } = usePlanDetails(intendedPlan);

  useEffect(() => {
    setIntendedPlan(readIntendedPlan());
  }, []);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      if (!supabase) {
        setError('Supabase não está configurado no ambiente.');
        setCheckingSession(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (!data?.session?.access_token) {
        router.replace('/login?next=/workspace/new');
        return;
      }

      // Conta que é só músico/membro não cria workspace: vai para o portal do membro.
      try {
        const meResponse = await fetch('/api/workspace/me', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const mePayload = await meResponse.json().catch(() => null);
        if (!active) return;
        if (mePayload?.code === 'MEMBER_ONLY') {
          router.replace('/membro');
          return;
        }
      } catch {
        // Sem resposta: segue o fluxo normal; o servidor recusa a criação para membros.
      }

      try {
        const pending = JSON.parse(window.localStorage.getItem('harmonics_pending_signup_bootstrap') || 'null');
        if (pending?.workspaceName) setWorkspaceName((current) => current || pending.workspaceName);
        if (pending?.supportWhatsapp) setSupportWhatsapp((current) => current || pending.supportWhatsapp);
      } catch {
        // dados pendentes são opcionais
      }

      setCheckingSession(false);
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!supabase) {
      setError('Supabase não está configurado no ambiente.');
      return;
    }

    if (!acceptedLegal) {
      setError('Para criar seu espaço, aceite os Termos de Uso e a Política de Privacidade.');
      return;
    }

    if (!workspaceName.trim()) {
      setError('Informe o nome do workspace, banda ou equipe.');
      return;
    }

    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;

      if (!accessToken) {
        router.replace('/login?next=/workspace/new');
        return;
      }

      const response = await fetch('/api/workspace/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          workspaceName,
          supportWhatsapp,
          primaryColor: normalizeHexColor(primaryColor),
          legalAcceptance: buildLegalAcceptance(),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        if (payload?.code === 'MEMBER_ONLY') {
          router.replace('/membro');
          return;
        }
        throw new Error(payload?.error || 'Não foi possível criar o workspace.');
      }

      resetWorkspaceScopedStorage(payload?.workspaceId);
      // Sempre converge para o onboarding oficial (a API também devolve next: '/onboarding').
      router.push(payload?.next || '/onboarding');
      router.refresh();
    } catch (err) {
      setError(err?.message || 'Não foi possível criar o workspace.');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return <PublicLoading label="Validando sessão..." />;
  }

  const linkClass = 'font-semibold text-violet-200 underline-offset-4 hover:text-white hover:underline';

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <PublicBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <BrandMark />
        <JourneySteps current="workspace" paidPlanName={intendedPlan ? planName : ''} />
      </header>

      <main className="relative z-10 mx-auto grid grid-cols-1 w-full max-w-5xl items-start gap-8 px-4 pb-16 pt-4 md:px-6 md:pt-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="lg:pt-6">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">Novo espaço</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">Crie o espaço da sua banda.</h1>
          <p className="mt-4 max-w-md text-base leading-7 text-slate-300">
            Sua conta já existe; falta só o espaço onde ficam eventos, contratos, escalas e equipe. Você será o responsável
            (owner) e, em seguida, faz a configuração rápida.
          </p>
        </section>

        <section className={`p-5 sm:p-7 md:p-8 ${panelClass}`}>
          <h2 className="text-2xl font-black tracking-[-0.03em]">Dados iniciais</h2>
          <p className="mt-1 text-sm text-slate-400">O restante pode ser ajustado depois em Configurações.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error ? <Alert tone="error">{error}</Alert> : null}

            <label className="block">
              <span className={labelClass}>Nome da banda ou equipe</span>
              <input
                type="text"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                required
                disabled={loading}
                className={inputClass}
                placeholder="Ex.: Banda Aurora"
                autoComplete="organization"
              />
            </label>

            <label className="block">
              <span className={labelClass}>
                WhatsApp principal <span className="font-normal text-slate-400">(opcional)</span>
              </span>
              <input
                type="tel"
                value={supportWhatsapp}
                onChange={(event) => setSupportWhatsapp(event.target.value)}
                disabled={loading}
                className={inputClass}
                placeholder="+55 71 99999-9999"
                autoComplete="tel"
              />
            </label>

            <div>
              <span className={labelClass}>
                Cor principal <span className="font-normal text-slate-400">(opcional)</span>
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={normalizeHexColor(primaryColor)}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  disabled={loading}
                  className="h-[52px] w-16 shrink-0 rounded-2xl border border-white/15 bg-white/[0.07] p-2 disabled:opacity-60"
                  aria-label="Cor principal do workspace"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  disabled={loading}
                  className={inputClass}
                  placeholder={DEFAULT_COLOR}
                  aria-label="Código da cor principal"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm leading-6 text-slate-300">
              <input
                type="checkbox"
                checked={acceptedLegal}
                onChange={(event) => setAcceptedLegal(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-violet-500"
                required
                disabled={loading}
              />
              <span>
                Li e aceito os{' '}
                <Link href="/termos" target="_blank" className={linkClass}>Termos de Uso</Link>
                {' '}e a{' '}
                <Link href="/privacidade" target="_blank" className={linkClass}>Política de Privacidade</Link>.
              </span>
            </label>

            <button type="submit" disabled={loading} className={`${primaryButtonClass} w-full`}>
              {loading ? (<><Spinner /> Criando seu espaço...</>) : 'Criar espaço e continuar'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
