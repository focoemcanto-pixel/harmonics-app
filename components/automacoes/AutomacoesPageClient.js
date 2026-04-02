'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Health helpers ────────────────────────────────────────────────────────────

function getHealthStatus(alerts, failedToday) {
  const hasCritical = alerts.some((a) => a.severity === 'critical');
  const hasWarnings = alerts.some((a) => a.severity === 'warning');

  if (hasCritical || failedToday > 5) {
    return {
      status: 'critical',
      label: 'Crítico',
      color: 'red',
      message: hasCritical
        ? 'Existem alertas críticos que precisam de atenção'
        : `${failedToday} falhas registradas hoje`,
    };
  }

  if (hasWarnings || failedToday > 0) {
    return {
      status: 'warning',
      label: 'Atenção',
      color: 'amber',
      message: hasWarnings
        ? 'Alguns alertas de atenção foram identificados'
        : `${failedToday} falha(s) registrada(s) hoje`,
    };
  }

  return {
    status: 'healthy',
    label: 'Saudável',
    color: 'emerald',
    message: 'Todas as automações estão funcionando corretamente',
  };
}

function getContextualCTA(healthStatus) {
  switch (healthStatus) {
    case 'critical':
      return { href: '/automacoes/logs?status=failed', label: 'Ver falhas', variant: 'danger' };
    case 'warning':
      return { href: '/automacoes/regras', label: 'Ver regras', variant: 'soft' };
    case 'healthy':
    default:
      return { href: '/automacoes/templates', label: 'Criar template', variant: 'success' };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }) {
  const colorMap = {
    green:  'bg-emerald-50 border-emerald-200 text-emerald-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    slate:  'bg-slate-50 border-slate-200 text-slate-600',
  };
  const valueColor = {
    green:  'text-emerald-800',
    red:    'text-red-800',
    amber:  'text-amber-800',
    violet: 'text-violet-800',
    slate:  'text-slate-700',
  };
  return (
    <div className={`rounded-[20px] border p-5 ${colorMap[color] ?? colorMap.slate}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">{label}</div>
      <div className={`mt-2 text-[32px] font-black tracking-[-0.04em] ${valueColor[color] ?? valueColor.slate}`}>
        {value ?? '–'}
      </div>
    </div>
  );
}

function AlertItem({ alert }) {
  const severityStyle = {
    critical: 'bg-red-50 border-red-200 text-red-700',
    warning:  'bg-amber-50 border-amber-200 text-amber-700',
  };
  const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
  return (
    <div className={`flex items-start gap-3 rounded-[14px] border px-4 py-3 ${severityStyle[alert.severity] ?? severityStyle.warning}`}>
      <span className="mt-0.5 text-base leading-none">{icon}</span>
      <span className="text-[14px] font-semibold leading-snug">{alert.message}</span>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors =
    type === 'success'
      ? 'bg-emerald-600 text-white'
      : 'bg-red-600 text-white';

  return (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2 rounded-2xl px-5 py-3 shadow-xl text-[14px] font-semibold ${colors}`}>
      {type === 'success' ? '✅' : '❌'} {message}
    </div>
  );
}

function FailureItem({ log, onRetry, loadingId }) {
  const isLoading = loadingId === log.id;
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[#fecaca] bg-red-50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-700">
            Falha
          </span>
          <span className="text-[13px] font-semibold text-[#0f172a]">
            {formatarTelefone(log.recipient_number)}
          </span>
        </div>
        <div className="text-[12px] text-[#64748b]">
          {log.rule_name || log.source || '—'} • {formatarData(log.created_at)}
        </div>
        {log.error_message && (
          <div className="mt-1 text-[12px] text-red-700">{log.error_message}</div>
        )}
      </div>
      <button
        onClick={() => onRetry(log.id)}
        disabled={isLoading}
        className="shrink-0 self-start inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            Processando...
          </>
        ) : (
          <>
            <RefreshIcon />
            Tentar novamente
          </>
        )}
      </button>
    </div>
  );
}

function QuickActionCard({ title, desc, href }) {
  return (
    <a
      href={href}
      className="block rounded-[20px] border border-[#dbe3ef] bg-white p-5 shadow-[0_4px_14px_rgba(17,24,39,0.04)] transition hover:shadow-[0_8px_24px_rgba(17,24,39,0.08)] hover:border-violet-200"
    >
      <div className="text-[17px] font-black tracking-[-0.02em] text-[#0f172a]">{title}</div>
      <div className="mt-1 text-[13px] leading-5 text-[#64748b]">{desc}</div>
      <div className="mt-3 text-[12px] font-bold text-violet-600">Acessar →</div>
    </a>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-[20px] border border-[#dbe3ef] bg-[#f8fafc] p-5 animate-pulse">
      <div className="h-3 w-24 rounded bg-[#e2e8f0]" />
      <div className="mt-3 h-8 w-16 rounded bg-[#e2e8f0]" />
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6 text-emerald-600"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function HealthIndicator({ health }) {
  const borderColors = {
    healthy: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    critical: 'border-l-red-500',
  };
  const bgColors = {
    healthy: 'bg-emerald-50',
    warning: 'bg-amber-50',
    critical: 'bg-red-50',
  };
  const badgeClasses = {
    healthy: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    critical: 'bg-red-100 text-red-700',
  };
  const ctaClasses = {
    healthy: 'bg-emerald-600 text-white hover:bg-emerald-700',
    warning: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    critical: 'bg-red-500 text-white hover:bg-red-600',
  };

  const cta = getContextualCTA(health.status);

  return (
    <div
      className={`rounded-[24px] border border-l-4 border-[#dbe3ef] shadow-[0_4px_14px_rgba(17,24,39,0.04)] ${borderColors[health.status]}`}
    >
      <div className={`rounded-[24px] p-5 ${bgColors[health.status]}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses[health.status]}`}
            >
              {health.label}
            </span>
            <span className="text-[14px] text-slate-700">{health.message}</span>
          </div>
          <a
            href={cta.href}
            className={`shrink-0 self-start sm:self-auto inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${ctaClasses[health.status]}`}
          >
            {cta.label}
          </a>
        </div>
      </div>
    </div>
  );
}

function EmptyStateAlertas() {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-[14px] p-6 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-3">
        <CheckCircleIcon />
      </div>
      <h3 className="text-[16px] font-bold text-emerald-900 mb-1">Tudo certo por aqui!</h3>
      <p className="text-[13px] text-emerald-700">
        Nenhum alerta crítico ou de atenção foi identificado
      </p>
    </div>
  );
}

function EmptyStateFalhas() {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-[14px] p-6 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-3">
        <CheckCircleIcon />
      </div>
      <h3 className="text-[16px] font-bold text-emerald-900 mb-1">Nenhuma falha recente</h3>
      <p className="text-[13px] text-emerald-700">
        Todos os envios estão sendo processados com sucesso
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AutomacoesPageClient() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [toast, setToast]         = useState(null);

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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao tentar novamente');
      setToast({ message: 'Reenvio realizado com sucesso', type: 'success' });
      fetchDashboard();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoadingId(null);
    }
  }

  const summary  = data?.summary  ?? {};
  const alerts   = data?.alerts   ?? [];
  const failures = data?.recent_failures ?? [];

  const health = !loading && data
    ? getHealthStatus(alerts, summary.failed_today ?? 0)
    : null;

  return (
    <div className="space-y-8">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
              Automação
            </div>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">
              Central de Automação
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#64748b]">
              Acompanhe a saúde das automações, identifique falhas e gerencie rapidamente templates, canais, regras e logs.
            </p>
          </div>
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="shrink-0 self-start rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-semibold text-[#475569] shadow-sm transition hover:bg-[#f8fafc] disabled:opacity-50"
          >
            {loading ? 'Atualizando…' : '↻ Atualizar'}
          </button>
        </div>
      </section>

      {/* ── Error state ───────────────────────────────────────── */}
      {error && (
        <div className="rounded-[20px] border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-[14px] font-semibold text-red-700">❌ {error}</p>
          <button
            onClick={fetchDashboard}
            className="mt-2 text-[13px] font-bold text-red-600 underline underline-offset-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Health indicator ──────────────────────────────────── */}
      {!loading && !error && health && (
        <section>
          <HealthIndicator health={health} />
        </section>
      )}

      {/* ── Summary cards ─────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">
          Resumo operacional
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <SummaryCard label="Regras ativas"    value={summary.active_rules}    color="violet" />
              <SummaryCard label="Templates ativos" value={summary.active_templates} color="violet" />
              <SummaryCard label="Canais ativos"    value={summary.active_channels}  color="violet" />
              <SummaryCard label="Envios hoje"      value={summary.sent_today}       color="green"  />
              <SummaryCard
                label="Falhas hoje"
                value={summary.failed_today}
                color={summary.failed_today > 0 ? 'red' : 'slate'}
              />
              <SummaryCard
                label="Skipped hoje"
                value={summary.skipped_today}
                color={summary.skipped_today > 0 ? 'amber' : 'slate'}
              />
            </>
          )}
        </div>
      </section>

      {/* ── Alerts ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">
          Alertas rápidos
        </h2>
        <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_4px_14px_rgba(17,24,39,0.04)]">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-10 rounded-[14px] bg-[#f1f5f9]" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <EmptyStateAlertas />
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <AlertItem key={i} alert={alert} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Recent failures ───────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">
            Últimas falhas
          </h2>
          <a
            href="/automacoes/logs?status=failed"
            className="text-[13px] font-bold text-violet-600 hover:underline underline-offset-2"
          >
            Ver todos os logs →
          </a>
        </div>
        <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_4px_14px_rgba(17,24,39,0.04)]">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded-[14px] bg-[#f1f5f9]" />
              ))}
            </div>
          ) : failures.length === 0 ? (
            <EmptyStateFalhas />
          ) : (
            <div className="space-y-2">
              {failures.map((log) => (
                <FailureItem
                  key={log.id}
                  log={log}
                  onRetry={handleRetry}
                  loadingId={loadingId}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Quick actions ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">
          Ações rápidas
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QuickActionCard
            title="Templates"
            desc="Mensagens configuráveis com variáveis dinâmicas"
            href="/automacoes/templates"
          />
          <QuickActionCard
            title="Canais"
            desc="Gerencie APIs e números de envio"
            href="/automacoes/canais"
          />
          <QuickActionCard
            title="Regras"
            desc="Defina quando e para quem cada automação é executada"
            href="/automacoes/regras"
          />
          <QuickActionCard
            title="Logs"
            desc="Histórico completo de todos os disparos"
            href="/automacoes/logs"
          />
        </div>
      </section>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
