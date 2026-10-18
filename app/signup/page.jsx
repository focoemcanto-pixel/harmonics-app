'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { planFromLocation, readIntendedPlan, saveIntendedPlan } from '@/lib/billing/intended-plan';
import { buildLegalAcceptance } from '@/lib/legal/documents';
import { formatMoney, planFeatureList } from '@/lib/billing/plan-presentation';
import PublicFooter from '@/components/public/PublicFooter';
import {
  Alert,
  BrandMark,
  JourneySteps,
  PublicBackground,
  Spinner,
  inputClass,
  labelClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/public/PublicUI';
import { usePlanDetails } from '@/components/public/usePlanDetails';

const PENDING_SIGNUP_KEY = 'harmonics_pending_signup_bootstrap';

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

function savePendingSignupBootstrap(form, legalAcceptance) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    PENDING_SIGNUP_KEY,
    JSON.stringify({
      fullName: form.fullName.trim(),
      workspaceName: form.workspaceName.trim(),
      supportWhatsapp: normalizePhone(form.whatsapp),
      timezone: 'America/Bahia',
      legalAcceptance,
      createdAt: new Date().toISOString(),
    })
  );
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    workspaceName: '',
    whatsapp: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [existingWorkspace, setExistingWorkspace] = useState(false);
  const [intendedPlan, setIntendedPlan] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  // Plano escolhido em /planos: a conta começa no Free e o checkout vem logo após o onboarding.
  useEffect(() => {
    const fromUrl = planFromLocation();
    setIntendedPlan(fromUrl ? saveIntendedPlan(fromUrl) : readIntendedPlan());
  }, []);

  const [showPassword, setShowPassword] = useState(false);
  const { details: planDetails, name: planName } = usePlanDetails(intendedPlan);

  function updateField(field, value) {
    setExistingWorkspace(false);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleExistingWorkspace() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PENDING_SIGNUP_KEY);
    }

    setError('');
    setSuccess('');
    setExistingWorkspace(true);
  }

  async function bootstrapWorkspace(accessToken, legalAcceptance) {
    const response = await fetch('/api/public/signup/bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        fullName: form.fullName.trim(),
        workspaceName: form.workspaceName.trim(),
        supportWhatsapp: normalizePhone(form.whatsapp),
        timezone: 'America/Bahia',
        legalAcceptance,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (payload?.code === 'MEMBER_ONLY') {
      router.push('/membro');
      return null;
    }

    if (response.status === 409 && payload?.code === 'USER_ALREADY_HAS_WORKSPACE') {
      handleExistingWorkspace();
      return null;
    }

    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || 'Não foi possível inicializar seu workspace.');
      error.code = payload?.code || null;
      throw error;
    }

    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setExistingWorkspace(false);

    if (!supabase) {
      setError('Supabase não está configurado no ambiente.');
      return;
    }

    if (!form.fullName.trim()) {
      setError('Informe seu nome.');
      return;
    }

    if (!form.email.trim()) {
      setError('Informe seu e-mail.');
      return;
    }

    // O formulário usa noValidate (mensagens próprias), então o formato do e-mail é checado aqui.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }

    if (String(form.password || '').length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    if (!form.workspaceName.trim()) {
      setError('Informe o nome da sua banda, equipe ou empresa.');
      return;
    }

    if (!acceptedLegal) {
      setError('Para criar sua conta, aceite os Termos de Uso e a Política de Privacidade.');
      return;
    }

    setLoading(true);

    try {
      // Versões vigentes + data/hora do aceite; o servidor registra junto com a data do registro.
      const legalAcceptance = buildLegalAcceptance();
      savePendingSignupBootstrap(form, legalAcceptance);
      const redirectTo = `${window.location.origin}/login?signup=confirmed`;

      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: form.fullName.trim(),
            workspace_name: form.workspaceName.trim(),
            signup_source: 'public_signup_page',
            legal_acceptance: legalAcceptance,
          },
        },
      });

      if (signupError) throw signupError;

      let accessToken = signupData?.session?.access_token || null;

      if (!accessToken) {
        const sessionResult = await supabase.auth.getSession();
        accessToken = sessionResult?.data?.session?.access_token || null;
      }

      if (!accessToken) {
        setSuccess('Conta criada! Confirme seu e-mail e depois faça login para finalizar o workspace.');
        router.push('/login?signup=check-email');
        return;
      }

      const payload = await bootstrapWorkspace(accessToken, legalAcceptance);
      if (!payload) return;

      window.localStorage.removeItem(PENDING_SIGNUP_KEY);
      setSuccess('Conta criada! Vamos finalizar a configuração inicial.');
      router.push(payload?.next || '/onboarding');
    } catch (err) {
      const message = String(err?.message || 'Erro ao criar conta.');
      if (err?.code === 'USER_ALREADY_HAS_WORKSPACE' || message.toLowerCase().includes('workspace ativo')) {
        handleExistingWorkspace();
      } else if (message.toLowerCase().includes('already')) {
        setError('Já existe uma conta com este e-mail. Tente fazer login.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  const nextStepLabel = intendedPlan ? `pagamento do ${planName}` : 'seu painel';
  const linkClass = 'font-semibold text-violet-200 underline-offset-4 hover:text-white hover:underline';

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <PublicBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 md:px-6">
        <BrandMark />
        <p className="text-sm text-slate-400">
          Já tem conta? <Link href="/login" className={linkClass}>Entrar</Link>
        </p>
      </header>

      <main className="relative z-10 mx-auto grid grid-cols-1 w-full max-w-6xl items-start gap-10 px-4 pb-16 pt-4 md:px-6 md:pt-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="order-2 space-y-6 lg:order-1 lg:pt-6">
          <div>
            <h1 className="text-[2.2rem] font-black leading-[1.05] tracking-[-0.05em] md:text-5xl">
              {intendedPlan ? `Crie sua conta e comece com o ${planName}.` : 'Crie sua conta grátis no Harmonics.'}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-300">
              Organize eventos, contratos, escalas, repertório e automações da sua banda, ministério ou equipe musical em um só lugar.
            </p>
          </div>

          {intendedPlan ? (
            <div className="rounded-[24px] border border-violet-300/30 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-transparent p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-200">Plano escolhido</p>
                  <p className="mt-1 text-2xl font-black tracking-[-0.03em]">{planName}</p>
                </div>
                {planDetails ? (
                  <p className="text-right text-2xl font-black tracking-[-0.03em]">
                    {formatMoney(planDetails.monthly_price)}
                    <span className="text-sm font-semibold text-slate-400">/mês</span>
                  </p>
                ) : null}
              </div>
              {planDetails ? (
                <ul className="mt-4 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
                  {planFeatureList(planDetails).filter((item) => item.included).map((item) => (
                    <li key={item.text} className="flex gap-2"><span className="text-emerald-300" aria-hidden="true">✓</span>{item.text}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Sem cartão agora: você cria a conta, configura seu espaço e só então conclui o pagamento (Pix, boleto ou cartão). Até
                lá, sua conta funciona no Free.
              </p>
              <Link href="/planos" className={`${linkClass} mt-3 inline-block text-sm`}>Trocar de plano</Link>
            </div>
          ) : (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-200">Plano Free</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Sua conta começa no Free, sem cartão. Quando precisar de automações, WhatsApp ou mais eventos, é só mudar de plano.
              </p>
              <Link href="/planos" className={`${linkClass} mt-3 inline-block text-sm`}>Ver planos</Link>
            </div>
          )}

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-black text-white">O que acontece depois</p>
            <ol className="mt-3 space-y-3 text-sm text-slate-300">
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-black">1</span>Criamos sua conta e o espaço da sua banda.</li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-black">2</span>Você confirma nome, contato e tipo de atuação em um passo rápido.</li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-black">3</span>{intendedPlan ? `Você conclui a assinatura do ${planName} e começa a usar.` : 'Você entra no painel e cadastra o primeiro evento.'}</li>
            </ol>
          </div>
        </section>

        <section className={`order-1 p-5 sm:p-7 md:p-8 lg:order-2 ${panelClass}`}>
          <JourneySteps current="account" paidPlanName={intendedPlan ? planName : ''} />

          {existingWorkspace ? (
            <div className="mt-7 space-y-5">
              <Alert tone="info">Este e-mail já possui um espaço no Harmonics.</Alert>
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-[-0.03em]">Entre para continuar.</h2>
                <p className="text-sm leading-6 text-slate-300">
                  Faça login com este e-mail e acesse normalmente o painel do seu espaço.
                </p>
              </div>
              <Link href="/login" className={`${primaryButtonClass} w-full`}>Entrar no painel</Link>
              <button type="button" onClick={() => setExistingWorkspace(false)} className={`${secondaryButtonClass} w-full py-3`}>
                Usar outro e-mail
              </button>
            </div>
          ) : (
            <>
              <div className="mt-7 space-y-1">
                <h2 className="text-2xl font-black tracking-[-0.03em]">Criar sua conta</h2>
                <p className="text-sm text-slate-400">
                  Próximo passo: configurar seu espaço · depois: {nextStepLabel}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Seu nome</span>
                    <input value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} className={inputClass} placeholder="Ex: Marcos Cruz" autoComplete="name" disabled={loading} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>WhatsApp principal</span>
                    <input value={form.whatsapp} onChange={(event) => updateField('whatsapp', event.target.value)} className={inputClass} placeholder="Ex: 71999999999" inputMode="tel" autoComplete="tel" disabled={loading} />
                  </label>
                </div>

                <label className="block">
                  <span className={labelClass}>Nome da banda ou equipe</span>
                  <input value={form.workspaceName} onChange={(event) => updateField('workspaceName', event.target.value)} className={inputClass} placeholder="Ex: Banda Aurora" autoComplete="organization" disabled={loading} />
                </label>

                <label className="block">
                  <span className={labelClass}>E-mail</span>
                  <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} className={inputClass} placeholder="voce@email.com" autoComplete="email" disabled={loading} />
                </label>

                <label className="block">
                  <span className={labelClass}>Senha</span>
                  <span className="relative block">
                    <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => updateField('password', event.target.value)} className={`${inputClass} pr-20`} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" disabled={loading} />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-3 my-auto h-8 rounded-lg px-2 text-xs font-bold text-slate-300 hover:text-white" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                      {showPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </span>
                </label>

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

                {error ? <Alert tone="error">{error}</Alert> : null}
                {success ? <Alert tone="success">{success}</Alert> : null}

                <button type="submit" disabled={loading} className={`${primaryButtonClass} w-full`}>
                  {loading ? (<><Spinner /> Criando sua conta...</>) : intendedPlan ? 'Criar conta e continuar' : 'Criar conta grátis'}
                </button>
                <p className="text-center text-xs text-slate-500">Sem cartão de crédito no cadastro.</p>
              </form>
            </>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
