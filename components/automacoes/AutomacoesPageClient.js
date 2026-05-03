'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { cachedPromise, invalidateCache, readCachedValue } from '@/lib/client/light-cache';
import { reportError } from '@/lib/observability/client-log';
import { useAppToast } from '@/components/ui/ToastProvider';

const DASHBOARD_CACHE_KEY = 'automation:dashboard';
const DASHBOARD_TTL_MS = 45_000;


const DISMISSED_ALERTS_KEY = 'automation_dismissed_alerts';

function readDismissedAlerts() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(DISMISSED_ALERTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveDismissedAlerts(nextValue) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(nextValue));
}

function toSingleProblemRuleId(rules, predicate) {
  const matches = rules.filter(predicate);
  return matches.length === 1 ? matches[0].id : null;
}

function buildFrontendAlerts(data) {
  const backendAlerts = data?.alerts ?? [];
  const rules = data?.rules ?? [];
  const cronStatus = data?.cron_status ?? {};
  const hasDefaultChannelReady = Boolean(data?.onboarding?.has_default_channel && data?.onboarding?.default_channel_ready);

  const alertMap = new Map(backendAlerts.map((item) => [item.type, item]));
  const missingTemplateCount = rules.filter((rule) => rule?.is_active && rule?.template_id == null).length;
  const missingChannelCount = rules.filter((rule) => rule?.is_active && rule?.channel_id == null).length;
  const missingTemplateRuleId = toSingleProblemRuleId(rules, (rule) => rule?.is_active && rule?.template_id == null);
  const missingChannelRuleId = toSingleProblemRuleId(rules, (rule) => rule?.is_active && rule?.channel_id == null);

  const normalized = [];

  backendAlerts
    .filter((alert) => !['rules_without_template', 'rules_without_channel', 'cron_status'].includes(alert.type))
    .forEach((alert) => normalized.push(alert));

  if (missingTemplateCount > 0 && alertMap.has('rules_without_template')) {
    normalized.push({
      ...alertMap.get('rules_without_template'),
      dismissKey: 'missing_template',
      message: `${missingTemplateCount} regra(s) não possui(em) mensagem configurada (template)`,
      cta: { href: `/automacoes/regras${missingTemplateRuleId ? `?highlightRule=${missingTemplateRuleId}` : ''}`, label: 'Revisar regra' },
    });
  }

  if (missingChannelCount > 0 && !hasDefaultChannelReady && alertMap.has('rules_without_channel')) {
    normalized.push({
      ...alertMap.get('rules_without_channel'),
      dismissKey: 'missing_channel',
      message: `${missingChannelCount} regra(s) estão usando canal padrão (não configuradas individualmente)`,
      cta: { href: `/automacoes/regras${missingChannelRuleId ? `?highlightRule=${missingChannelRuleId}` : ''}`, label: 'Revisar regra' },
    });
  }

  if (cronStatus.status === 'never_run' && alertMap.has('cron_status')) {
    normalized.push({
      ...alertMap.get('cron_status'),
      dismissKey: 'cron',
      cta: { href: '/automacoes/logs', label: 'Abrir logs' },
    });
  }

  return normalized;
}
function getHealthStatus(systemState, summary, alerts, hasRealErrors) {
  const failedToday = summary.failed_today ?? 0;

  if (systemState === 'operational_failure') {
    return {
      status: 'critical',
      label: 'Crítico',
      message: failedToday > 0
        ? `${failedToday} falha(s) operacional(is) registrada(s) hoje`
        : 'Existem falhas operacionais recentes',
      cta: { href: '/automacoes/logs?status=failed', label: 'Ver falhas' },
    };
  }

  if (systemState === 'configuration_pending_critical') {
    return {
      status: 'warning',
      label: 'Configuração pendente',
      message: 'A automação está bloqueada por configuração obrigatória ausente',
      cta: { href: '/automacoes/canais', label: 'Concluir setup' },
    };
  }

  if (systemState === 'partially_configured') {
    if (!hasRealErrors) {
      return {
        status: 'healthy',
        label: 'Configuração OK',
        message: 'Não há pendências reais de configuração',
        cta: { href: '/automacoes/regras', label: 'Ver regras' },
      };
    }

    return {
      status: 'warning',
      label: 'Parcialmente configurado',
      message: 'A estrutura existe, mas ainda há itens de configuração pendentes',
      cta: { href: '/automacoes/regras', label: 'Revisar configuração' },
    };
  }

  if (systemState === 'healthy_no_activity') {
    return {
      status: 'healthy',
      label: 'Saudável sem atividade',
      message: 'Nenhum envio hoje, mas sem falhas e com configuração válida',
      cta: { href: '/automacoes/regras', label: 'Ativar regra' },
    };
  }

  const hasAttentionAlert = alerts.some((alert) => alert.level === 'attention');

  return {
    status: hasAttentionAlert ? 'warning' : 'healthy',
    label: hasAttentionAlert ? 'Atenção' : 'Saudável',
    message: hasAttentionAlert
      ? 'Existem alertas de atenção que merecem revisão'
      : 'Automação operando normalmente',
    cta: hasAttentionAlert
      ? { href: '/automacoes/regras', label: 'Ver detalhes' }
      : { href: '/automacoes/templates', label: 'Criar template' },
  };
}

function formatarData(isoString) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function formatarTelefone(numero) {
  if (!numero) return '-';
  const d = numero.replace(/\D/g, '');
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return numero;
}

function SummaryCard({ label, value, color }) {
  const colorMap = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-600',
  };

  return (
    <div className={`rounded-[20px] border p-5 ${colorMap[color] ?? colorMap.slate}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">{label}</div>
      <div className="mt-2 text-[32px] font-black tracking-[-0.04em] text-slate-800">{value ?? '–'}</div>
    </div>
  );
}

function AlertItem({ alert, onDismiss }) {
  const levelStyle = {
    critical: 'bg-red-50 border-red-200 text-red-700',
    attention: 'bg-amber-50 border-amber-200 text-amber-700',
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };

  const icon = alert.level === 'critical' ? '🔴' : alert.level === 'attention' ? '⚠️' : '✅';

  return (
    <div className={`flex items-start justify-between gap-3 rounded-[14px] border px-4 py-3 ${levelStyle[alert.level] ?? levelStyle.attention}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{icon}</span>
        <div>
          <div className="text-[14px] font-semibold leading-snug">{alert.message}</div>
          {alert.kind && <div className="text-[11px] uppercase tracking-wider opacity-70 mt-0.5">{alert.kind}</div>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {alert.cta?.href && (
          <Link href={alert.cta.href} className="text-[12px] font-bold underline underline-offset-2">
            {alert.cta.label}
          </Link>
        )}
        {alert.dismissKey && (
          <button type="button" onClick={() => onDismiss(alert.dismissKey)} className="text-[11px] font-semibold opacity-80 hover:opacity-100">Ocultar</button>
        )}
      </div>
    </div>
  );
}

function EmptyStateFalhas({ systemState }) {
  const hint =
    systemState === 'configuration_pending_critical'
      ? 'Não há falhas de dispatch recentes. O bloqueio atual é de configuração.'
      : 'Todos os envios recentes foram processados sem falhas.';

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-[14px] p-6 text-center">
      <h3 className="text-[16px] font-bold text-emerald-900 mb-1">Nenhuma falha recente</h3>
      <p className="text-[13px] text-emerald-700">{hint}</p>
    </div>
  );
}

function HealthIndicator({ health }) {
  const styles = {
    healthy: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    critical: 'border-red-200 bg-red-50 text-red-900',
  };

  return (
    <div className={`rounded-[24px] border p-5 ${styles[health.status]}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em]">{health.label}</div>
          <div className="text-sm mt-1">{health.message}</div>
        </div>
        <Link href={health.cta.href} className="inline-flex rounded-2xl px-4 py-2 bg-slate-900 text-white text-sm font-semibold">
          {health.cta.label}
        </Link>
      </div>
    </div>
  );
}

function CronStatusCard({ cronStatus }) {
  const tone = cronStatus?.level === 'critical' ? 'text-red-700' : cronStatus?.level === 'attention' ? 'text-amber-700' : 'text-emerald-700';

  return (
    <section className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_4px_14px_rgba(17,24,39,0.04)]">
      <h2 className="text-[13px] font-black uppercase tracking-[0.1em] text-[#94a3b8] mb-2">Scheduler / Cron</h2>
      <p className={`text-[14px] font-semibold ${tone}`}>{cronStatus?.message || 'Sem dados de cron'}</p>
      <p className="text-[12px] text-[#64748b] mt-1">Última execução: {formatarData(cronStatus?.last_run_at)}</p>
      {cronStatus?.details && <p className="text-[12px] text-red-700 mt-2">{cronStatus.details}</p>}
    </section>
  );
}

function SetupCtas({ onboarding }) {
  const items = [];
  if (!onboarding?.has_default_channel || !onboarding?.default_channel_ready) {
    items.push({ href: '/automacoes/canais', label: 'Configurar canal padrão' });
  }
  if (!onboarding?.has_active_template) {
    items.push({ href: '/automacoes/templates', label: 'Criar template ativo' });
  }
  if (!onboarding?.has_active_rule) {
    items.push({ href: '/automacoes/regras', label: 'Criar regra ativa' });
  }

  if (!items.length) return null;

  return (
    <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-[13px] font-black uppercase tracking-[0.1em] text-amber-700 mb-2">Setup pendente</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-full border border-amber-300 px-4 py-2 text-[13px] font-bold text-amber-800 bg-white">
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function AutomacoesPageClient() {
  const toast = useAppToast();
  const [data, setData] = useState(() => readCachedValue(DASHBOARD_CACHE_KEY) ?? null);
  const [loading, setLoading] = useState(() => !readCachedValue(DASHBOARD_CACHE_KEY));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [dismissedAlerts, setDismissedAlerts] = useState({});

  const fetchDashboard = useCallback(async ({ force = false, silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const json = await cachedPromise(
        DASHBOARD_CACHE_KEY,
        async () => {
          const [dashboardRes, rulesRes] = await Promise.all([
            fetch('/api/automation/dashboard'),
            fetch('/api/automation/rules'),
          ]);
          const [dashboardPayload, rulesPayload] = await Promise.all([dashboardRes.json(), rulesRes.json()]);
          if (!dashboardRes.ok) throw new Error(dashboardPayload.error || 'Erro ao carregar dashboard');
          return {
            ...dashboardPayload,
            rules: Array.isArray(rulesPayload?.rules) ? rulesPayload.rules : [],
          };
        },
        { ttlMs: DASHBOARD_TTL_MS, force }
      );
      setData(json);
    } catch (err) {
      reportError('automacoes.dashboard', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setDismissedAlerts(readDismissedAlerts());
    fetchDashboard({ silent: Boolean(readCachedValue(DASHBOARD_CACHE_KEY)) });
  }, [fetchDashboard]);

  async function handleRetry(logId) {
    if (loadingId) return;
    try {
      setLoadingId(logId);
      const res = await fetch('/api/automation/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Erro ao tentar novamente');
      invalidateCache(DASHBOARD_CACHE_KEY);
      await fetchDashboard({ force: true, silent: true });
    } catch (err) {
      reportError('automacoes.retry', err, { logId });
      setError(err?.message || 'Não foi possível reenviar agora.');
    } finally {
      setLoadingId(null);
    }
  }

  function handleDismissAlert(dismissKey) {
    const nextValue = { ...dismissedAlerts, [dismissKey]: true };
    setDismissedAlerts(nextValue);
    saveDismissedAlerts(nextValue);
  }

  const summary = data?.summary ?? {};
  const rawAlerts = useMemo(() => (data ? buildFrontendAlerts(data) : []), [data]);
  const alerts = useMemo(() => rawAlerts.filter((alert) => !dismissedAlerts?.[alert.dismissKey]), [rawAlerts, dismissedAlerts]);
  const hasHiddenAlerts = useMemo(
    () => rawAlerts.some((alert) => alert.dismissKey && dismissedAlerts?.[alert.dismissKey]),
    [rawAlerts, dismissedAlerts]
  );

  function hideVisualAlerts() {
    const dismissibleAlertKeys = rawAlerts
      .map((alert) => alert.dismissKey)
      .filter(Boolean);

    if (dismissibleAlertKeys.length === 0) return;

    const nextValue = { ...dismissedAlerts };
    dismissibleAlertKeys.forEach((dismissKey) => {
      nextValue[dismissKey] = true;
    });

    setDismissedAlerts(nextValue);
    saveDismissedAlerts(nextValue);
    toast.success('Alertas visuais ocultados.');
  }

  function restoreHiddenAlerts() {
    setDismissedAlerts({});
    if (typeof window !== 'undefined') window.localStorage.removeItem(DISMISSED_ALERTS_KEY);
  }

  const failures = data?.recent_failures ?? [];
  const systemState = data?.system_state;
  const hasRealErrors = rawAlerts.length > 0;
  const health = data ? getHealthStatus(systemState, summary, alerts, hasRealErrors) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">Automação</div>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">Central de Automação</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={hideVisualAlerts}
              className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] font-semibold text-amber-800"
            >
              Ocultar alertas visuais
            </button>
            {hasHiddenAlerts && (
              <button
                type="button"
                onClick={restoreHiddenAlerts}
                className="rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-2 text-[12px] font-semibold text-slate-700"
              >
                Reexibir alertas
              </button>
            )}
            <button
              onClick={() => {
                invalidateCache(DASHBOARD_CACHE_KEY);
                fetchDashboard({ force: true, silent: Boolean(data) });
              }}
              disabled={loading || refreshing}
              className="rounded-[14px] border border-[#dbe3ef] px-4 py-2 text-[13px] font-semibold"
            >
              {loading || refreshing ? 'Atualizando…' : '↻ Atualizar'}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 text-red-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>❌ {error}</span>
            <button
              type="button"
              onClick={() => fetchDashboard({ force: true, silent: Boolean(data) })}
              className="rounded-xl border border-red-300 bg-white px-3 py-1.5 text-[12px] font-black text-red-700 hover:bg-red-50"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
      {!loading && !error && health && <HealthIndicator health={health} />}
      {!loading && !error && <SetupCtas onboarding={data?.onboarding} />}

      {loading && !data ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-[20px] border border-slate-200 bg-slate-50 p-5 animate-pulse">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="mt-4 h-8 w-14 rounded bg-slate-200" />
            </div>
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Regras ativas" value={summary.active_rules} color="violet" />
          <SummaryCard label="Templates ativos" value={summary.active_templates} color="violet" />
          <SummaryCard label="Canais ativos" value={summary.active_channels} color="violet" />
          <SummaryCard label="Envios hoje" value={summary.sent_today} color="green" />
          <SummaryCard label="Falhas hoje" value={summary.failed_today} color={summary.failed_today > 0 ? 'red' : 'slate'} />
          <SummaryCard label="Skipped hoje" value={summary.skipped_today} color={summary.skipped_today > 0 ? 'amber' : 'slate'} />
        </section>
      )}

      {!loading && !error && <CronStatusCard cronStatus={data?.cron_status} />}

      <section className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_4px_14px_rgba(17,24,39,0.04)]">
        <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">Alertas rápidos</h2>
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={`alert-skeleton-${index}`} className="h-16 animate-pulse rounded-[14px] bg-slate-100" />
            ))}
          </div>
        ) : alerts.length === 0 ? <div className="text-sm text-emerald-700">✅ Sem alertas críticos no momento.</div> : (
          <div className="space-y-2">{alerts.map((alert, i) => <AlertItem key={`${alert.type}-${i}`} alert={alert} onDismiss={handleDismissAlert} />)}</div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">Últimas falhas</h2>
          <Link href="/automacoes/logs" className="text-[13px] font-bold text-violet-600">Ver todos os logs →</Link>
        </div>
        <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_4px_14px_rgba(17,24,39,0.04)]">
          {loading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={`failure-skeleton-${index}`} className="h-20 animate-pulse rounded-[14px] bg-slate-100" />
              ))}
            </div>
          ) : failures.length === 0 ? (
            <EmptyStateFalhas systemState={systemState} />
          ) : (
            <div className="space-y-2">
              {failures.map((log) => (
                <div key={log.id} className="flex flex-col gap-3 rounded-[14px] border border-[#fecaca] bg-red-50 px-4 py-3 sm:flex-row sm:justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-[#0f172a]">{formatarTelefone(log.recipient_number)}</div>
                    <div className="text-[12px] text-[#64748b]">{log.rule_name || log.source || '—'} • {formatarData(log.created_at)}</div>
                    {log.error_message && <div className="text-[12px] text-red-700 mt-1">{log.error_message}</div>}
                  </div>
                  <button onClick={() => handleRetry(log.id)} disabled={loadingId === log.id} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-700">
                    {loadingId === log.id ? 'Processando...' : 'Tentar novamente'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
