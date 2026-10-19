'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearIntendedPlan, planFromLocation, readIntendedPlan } from '@/lib/billing/intended-plan';

// Tela de assinatura: planos vêm de /api/billing/plans (mesma fonte dos limites no backend).

const STATUS_LABEL = {
  active: { label: 'Ativa', tone: 'bg-emerald-100 text-emerald-800' },
  trialing: { label: 'Em teste', tone: 'bg-sky-100 text-sky-800' },
  past_due: { label: 'Pagamento em atraso', tone: 'bg-amber-100 text-amber-900' },
  canceled: { label: 'Cancelada', tone: 'bg-slate-200 text-slate-700' },
  cancelled: { label: 'Cancelada', tone: 'bg-slate-200 text-slate-700' },
  paused: { label: 'Pausada', tone: 'bg-slate-200 text-slate-700' },
};

const EVENT_LABEL = {
  PAYMENT_CONFIRMED: 'Pagamento confirmado',
  PAYMENT_RECEIVED: 'Pagamento recebido',
  PAYMENT_OVERDUE: 'Pagamento em atraso',
  PAYMENT_CREATED: 'Cobrança gerada',
  PAYMENT_REFUNDED: 'Pagamento estornado',
};

function money(value) {
  const number = Number(value || 0);
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateBR(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function limitText(value, unit) {
  return value === null || value === undefined ? `${unit} ilimitados` : `${value} ${unit}`;
}

export default function BillingClient() {
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyPlan, setBusyPlan] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [askDocumentFor, setAskDocumentFor] = useState('');
  // Plano escolhido em /planos (ou ?plan=): só destaca o cartão; a assinatura continua exigindo o clique.
  const [chosenSlug, setChosenSlug] = useState('');

  useEffect(() => {
    setChosenSlug(planFromLocation() || readIntendedPlan());
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      const [plansResponse, summaryResponse] = await Promise.all([
        fetch('/api/billing/plans', { cache: 'no-store' }),
        fetch('/api/billing/summary', { cache: 'no-store' }),
      ]);
      const plansJson = await plansResponse.json().catch(() => null);
      const summaryJson = await summaryResponse.json().catch(() => null);
      if (!plansResponse.ok || !plansJson?.ok) throw new Error(plansJson?.error || 'Não foi possível carregar os planos.');
      if (!summaryResponse.ok || !summaryJson?.ok) throw new Error(summaryJson?.error || 'Não foi possível carregar sua assinatura.');
      setPlans(plansJson.plans || []);
      setSummary(summaryJson);
    } catch (err) {
      setError(err?.message || 'Erro ao carregar assinatura.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Retorno do checkout: o pagamento é confirmado por webhook; atualiza ao voltar para a aba.
    function onFocus() {
      if (document.visibilityState === 'visible') load();
    }
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [load]);

  const currentSlug = summary?.subscription?.plan?.slug || summary?.effectivePlan?.slug || 'free';
  const status = summary?.subscription?.status || 'active';
  const statusInfo = STATUS_LABEL[status] || STATUS_LABEL.active;
  const chosenPlan = useMemo(
    () => (chosenSlug && chosenSlug !== currentSlug ? plans.find((plan) => plan.slug === chosenSlug) || null : null),
    [plans, chosenSlug, currentSlug]
  );

  useEffect(() => {
    if (chosenSlug && chosenSlug === currentSlug) clearIntendedPlan();
  }, [chosenSlug, currentSlug]);

  useEffect(() => {
    if (chosenPlan) document.getElementById(`plan-${chosenPlan.slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [chosenPlan]);

  useEffect(() => {
    if (!askDocumentFor) return;
    const input = document.getElementById(`doc-${askDocumentFor}`);
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus({ preventScroll: true });
  }, [askDocumentFor]);

  const [activatedPlanName, setActivatedPlanName] = useState('');
  const pendingPlanIdRef = useRef(null);

  const pendingPlan = useMemo(
    () => plans.find((plan) => plan.id === summary?.subscription?.pending_checkout?.plan_id) || null,
    [plans, summary]
  );

  // Enquanto o pagamento não é confirmado (webhook), recarrega a cada 15 s; quando o plano
  // pendente vira o plano atual, mostra a confirmação.
  useEffect(() => {
    if (!pendingPlan) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [pendingPlan, load]);

  useEffect(() => {
    if (pendingPlan) {
      pendingPlanIdRef.current = pendingPlan;
      return;
    }
    const previous = pendingPlanIdRef.current;
    if (previous && previous.slug === currentSlug) setActivatedPlanName(previous.name);
    pendingPlanIdRef.current = null;
  }, [pendingPlan, currentSlug]);

  async function subscribe(planSlug) {
    if (busyPlan) return;
    setBusyPlan(planSlug);
    setError('');
    // Aberta ainda no clique (gesto do usuário) para o navegador não bloquear; o app continua
    // aberto nesta aba e detecta sozinho a confirmação do pagamento.
    let paymentWindow = null;
    try {
      paymentWindow = window.open('', '_blank');
    } catch {}
    try {
      const response = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug, cpfCnpj }),
      });
      const json = await response.json().catch(() => null);
      if (json?.code === 'CPF_CNPJ_REQUIRED') {
        setAskDocumentFor(planSlug);
        return;
      }
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Não foi possível iniciar a assinatura.');
      setAskDocumentFor('');
      clearIntendedPlan();
      if (json.checkoutUrl) {
        if (paymentWindow && !paymentWindow.closed) {
          paymentWindow.opener = null;
          paymentWindow.location.href = json.checkoutUrl;
          paymentWindow = null;
          await load();
        } else {
          window.location.assign(json.checkoutUrl);
        }
        return;
      }
      await load();
    } catch (err) {
      setError(err?.message || 'Erro ao assinar.');
    } finally {
      if (paymentWindow && !paymentWindow.closed) paymentWindow.close();
      setBusyPlan('');
    }
  }

  async function cancel() {
    if (canceling) return;
    if (!window.confirm('Cancelar a assinatura? Você mantém o plano atual até o fim do período já pago.')) return;
    setCanceling(true);
    setError('');
    try {
      const response = await fetch('/api/billing/cancel', { method: 'POST' });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Não foi possível cancelar.');
      await load();
    } catch (err) {
      setError(err?.message || 'Erro ao cancelar.');
    } finally {
      setCanceling(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-40 animate-pulse rounded-[24px] bg-slate-100" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((key) => <div key={key} className="h-56 animate-pulse rounded-[24px] bg-slate-100" />)}
        </div>
      </div>
    );
  }

  const subscription = summary?.subscription;
  const canManage = summary?.canManage === true;
  const usage = summary?.usage || {};
  const effective = summary?.effectivePlan || {};

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{error}</div>
      ) : null}

      {status === 'past_due' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" role="status">
          Identificamos um pagamento em atraso. Regularize para manter os recursos do seu plano — após 7 dias de atraso o
          workspace passa a usar os limites do plano Free (seus dados continuam guardados).
        </div>
      ) : null}

      {chosenPlan && !summary?.internal && !pendingPlan ? (
        <section className="rounded-[24px] bg-gradient-to-r from-violet-700 via-fuchsia-700 to-purple-800 p-5 text-white shadow-[0_18px_42px_rgba(124,58,237,0.28)] md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-100">Plano escolhido</div>
              <h2 className="mt-1 text-[24px] font-black tracking-[-0.04em]">
                {chosenPlan.name} · {money(chosenPlan.monthly_price)}<span className="text-sm font-semibold text-violet-100">/mês</span>
              </h2>
              <p className="mt-1 max-w-xl text-sm font-semibold leading-6 text-violet-50">
                Pague por Pix, boleto ou cartão. O plano é ativado assim que o pagamento é confirmado; até lá seu espaço segue no {effective.name || 'plano atual'}.
              </p>
            </div>
            {canManage && summary?.paymentsConfigured ? (
              <button
                type="button"
                onClick={() => subscribe(chosenPlan.slug)}
                disabled={Boolean(busyPlan)}
                className="shrink-0 rounded-2xl bg-white px-6 py-4 text-sm font-black text-violet-800 transition hover:bg-violet-50 disabled:opacity-60"
              >
                {busyPlan === chosenPlan.slug ? 'Abrindo pagamento...' : `Assinar o ${chosenPlan.name}`}
              </button>
            ) : (
              <p className="shrink-0 rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold">
                {canManage ? 'Pagamentos online em configuração.' : 'Só o responsável pelo espaço pode assinar.'}
              </p>
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-[#e4e7ec] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">Plano atual</div>
            <h2 className="mt-1 text-[28px] font-black tracking-[-0.04em] text-[#0f172a]">
              {summary?.internal ? 'Plano interno' : subscription?.plan?.name || 'Free'}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-[12px] font-black ${statusInfo.tone}`}>{statusInfo.label}</span>
              {subscription?.cancel_at_period_end ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-black text-slate-700">
                  Cancelada — acesso até {dateBR(subscription.current_period_end)}
                </span>
              ) : null}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm md:min-w-[320px]">
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-[11px] font-black uppercase text-slate-500">Mensalidade</dt>
              <dd className="mt-1 font-black text-[#0f172a]">{money(subscription?.plan?.monthly_price)}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-[11px] font-black uppercase text-slate-500">Próxima cobrança</dt>
              <dd className="mt-1 font-black text-[#0f172a]">
                {subscription?.provider && !subscription?.cancel_at_period_end ? dateBR(subscription.current_period_end) : '—'}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-[11px] font-black uppercase text-slate-500">Eventos este mês</dt>
              <dd className="mt-1 font-black text-[#0f172a]">
                {usage.eventsThisMonth ?? 0}{effective.unlimited || effective.max_events_per_month == null ? '' : ` / ${effective.max_events_per_month}`}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-[11px] font-black uppercase text-slate-500">Equipe</dt>
              <dd className="mt-1 font-black text-[#0f172a]">
                {usage.activeMembers ?? 0}{effective.unlimited || effective.max_members == null ? '' : ` / ${effective.max_members}`}
              </dd>
            </div>
            {effective.unlimited || effective.can_use_whatsapp ? (
              <div className="rounded-2xl bg-slate-50 p-3">
                <dt className="text-[11px] font-black uppercase text-slate-500">WhatsApp no período</dt>
                <dd className="mt-1 font-black text-[#0f172a]">
                  {usage.whatsappMessages ?? 0}{effective.unlimited || effective.max_whatsapp_messages == null ? '' : ` / ${effective.max_whatsapp_messages}`}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        {activatedPlanName ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            Pagamento confirmado: o plano {activatedPlanName} está ativo.
          </div>
        ) : null}

        {pendingPlan ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm md:flex-row md:items-center md:justify-between">
            <span className="font-semibold text-violet-900">
              Aguardando a confirmação do pagamento do plano {pendingPlan.name}. Assim que o pagamento for confirmado, o plano é
              ativado automaticamente.
            </span>
            {subscription?.pending_checkout?.invoice_url ? (
              <a href={subscription.pending_checkout.invoice_url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-violet-600 px-4 py-2 text-center font-black text-white">
                Abrir cobrança
              </a>
            ) : null}
          </div>
        ) : null}

        {canManage && subscription?.provider && !subscription?.cancel_at_period_end ? (
          <button type="button" onClick={cancel} disabled={canceling} className="mt-4 rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-60">
            {canceling ? 'Cancelando...' : 'Cancelar assinatura'}
          </button>
        ) : null}
      </section>

      {!summary?.internal ? (
        <section>
          <h2 className="mb-3 text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">Planos</h2>
          {!summary?.paymentsConfigured ? (
            <p className="mb-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              Os pagamentos online ainda estão sendo configurados. Os planos abaixo já mostram o que cada um inclui.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => {
              const isCurrent = plan.slug === currentSlug;
              const isPaid = Number(plan.monthly_price) > 0;
              const isChosen = chosenPlan?.slug === plan.slug;
              return (
                <article
                  key={plan.id}
                  id={`plan-${plan.slug}`}
                  className={`flex flex-col rounded-[24px] border p-5 ${isCurrent ? 'border-violet-400 bg-violet-50/60' : isChosen ? 'border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-300' : 'border-[#e4e7ec] bg-white'}`}
                >
                  {isChosen ? <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Plano escolhido</div> : null}
                  <h3 className="text-lg font-black text-[#0f172a]">{plan.name}</h3>
                  <div className="mt-1 text-2xl font-black text-[#0f172a]">
                    {isPaid ? `${money(plan.monthly_price)}` : 'Grátis'}
                    {isPaid ? <span className="text-sm font-semibold text-slate-500">/mês</span> : null}
                  </div>
                  <ul className="mt-3 flex-1 space-y-1 text-sm font-semibold text-slate-600">
                    <li>{limitText(plan.max_events_per_month, 'eventos/mês')}</li>
                    <li>{limitText(plan.max_members, 'membros')}</li>
                    <li>{plan.can_use_contracts ? 'Contratos e assinatura online' : 'Sem contratos'}</li>
                    <li>{plan.can_use_automation ? 'Automações' : 'Sem automações'}</li>
                    <li>{plan.can_use_whatsapp ? 'WhatsApp integrado' : 'Sem WhatsApp integrado'}</li>
                  </ul>
                  {isCurrent ? (
                    <div className="mt-4 rounded-xl bg-white px-4 py-3 text-center text-sm font-black text-violet-700">Plano atual</div>
                  ) : isPaid && canManage ? (
                    <button
                      type="button"
                      onClick={() => subscribe(plan.slug)}
                      disabled={Boolean(busyPlan) || !summary?.paymentsConfigured}
                      className="mt-4 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                    >
                      {busyPlan === plan.slug ? 'Abrindo pagamento...' : subscription?.provider ? 'Mudar para este plano' : 'Assinar'}
                    </button>
                  ) : null}
                  {askDocumentFor === plan.slug ? (
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-black text-slate-600" htmlFor={`doc-${plan.slug}`}>CPF ou CNPJ para a cobrança</label>
                      <input id={`doc-${plan.slug}`} value={cpfCnpj} onChange={(event) => setCpfCnpj(event.target.value)} inputMode="numeric" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base" />
                      <button type="button" onClick={() => subscribe(plan.slug)} className="w-full rounded-xl bg-[#0f172a] px-4 py-2 text-sm font-black text-white">Continuar</button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-[#e4e7ec] bg-white p-5 md:p-6">
        <h2 className="text-[20px] font-black tracking-[-0.03em] text-[#0f172a]">Histórico de cobranças</h2>
        {summary?.history?.length ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {summary.history.map((item, index) => (
              <li key={`${item.event_type}-${item.received_at}-${index}`} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-black text-[#0f172a]">{EVENT_LABEL[item.event_type] || item.event_type}</span>
                <span className="font-semibold text-slate-500">
                  {dateBR(item.event_created_at || item.received_at)}
                  {item.value ? ` • ${money(item.value)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm font-semibold text-slate-500">Nenhuma cobrança ainda. Quando você assinar um plano, os pagamentos aparecem aqui.</p>
        )}
      </section>
    </div>
  );
}
