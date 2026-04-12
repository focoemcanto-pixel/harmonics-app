'use client';

import { useState, useEffect, useCallback } from 'react';

function getHealthStatus(systemState, summary, alerts) {
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

function AlertItem({ alert }) {
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
      {alert.cta?.href && (
        <a href={alert.cta.href} className="text-[12px] font-bold underline underline-offset-2">
          {alert.cta.label}
        </a>
      )}
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
        <a href={health.cta.href} className="inline-flex rounded-2xl px-4 py-2 bg-slate-900 text-white text-sm font-semibold">
          {health.cta.label}
        </a>
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
          <a key={item.href} href={item.href} className="rounded-full border border-amber-300 px-4 py-2 text-[13px] font-bold text-amber-800 bg-white">
            {item.label}
          </a>
        ))}
      </div>
    </section>
  );
}

export default function AutomacoesPageClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/automation/dashboard');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar dashboard');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

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
      await fetchDashboard();
    } finally {
      setLoadingId(null);
    }
  }

  const summary = data?.summary ?? {};
  const alerts = data?.alerts ?? [];
  const failures = data?.recent_failures ?? [];
  const systemState = data?.system_state;
  const health = data ? getHealthStatus(systemState, summary, alerts) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">Automação</div>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">Central de Automação</h1>
          </div>
          <button onClick={fetchDashboard} disabled={loading} className="rounded-[14px] border border-[#dbe3ef] px-4 py-2 text-[13px] font-semibold">
            {loading ? 'Atualizando…' : '↻ Atualizar'}
          </button>
        </div>
      </section>

      {error && <div className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-4 text-red-700">❌ {error}</div>}
      {!loading && !error && health && <HealthIndicator health={health} />}
      {!loading && !error && <SetupCtas onboarding={data?.onboarding} />}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Regras ativas" value={summary.active_rules} color="violet" />
        <SummaryCard label="Templates ativos" value={summary.active_templates} color="violet" />
        <SummaryCard label="Canais ativos" value={summary.active_channels} color="violet" />
        <SummaryCard label="Envios hoje" value={summary.sent_today} color="green" />
        <SummaryCard label="Falhas hoje" value={summary.failed_today} color={summary.failed_today > 0 ? 'red' : 'slate'} />
        <SummaryCard label="Skipped hoje" value={summary.skipped_today} color={summary.skipped_today > 0 ? 'amber' : 'slate'} />
      </section>

      {!loading && !error && <CronStatusCard cronStatus={data?.cron_status} />}

      <section className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_4px_14px_rgba(17,24,39,0.04)]">
        <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">Alertas rápidos</h2>
        {alerts.length === 0 ? <div className="text-sm text-emerald-700">✅ Sem alertas críticos no momento.</div> : (
          <div className="space-y-2">{alerts.map((alert, i) => <AlertItem key={i} alert={alert} />)}</div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">Últimas falhas</h2>
          <a href="/automacoes/logs?status=failed" className="text-[13px] font-bold text-violet-600">Ver todos os logs →</a>
        </div>
        <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_4px_14px_rgba(17,24,39,0.04)]">
          {failures.length === 0 ? (
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
