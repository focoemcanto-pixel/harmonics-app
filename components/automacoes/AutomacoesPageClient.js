'use client';

import { useState, useEffect, useCallback } from 'react';

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

function FailureRow({ log }) {
  return (
    <div className="grid grid-cols-1 gap-1 rounded-[14px] border border-[#fecaca] bg-red-50 px-4 py-3 sm:grid-cols-[1fr_1.5fr_1fr_1.5fr]">
      <div className="text-[12px] text-[#94a3b8]">{formatarData(log.created_at)}</div>
      <div className="truncate text-[13px] font-semibold text-[#0f172a]">
        {log.rule_name || log.source || '—'}
      </div>
      <div className="text-[13px] text-[#475569]">{formatarTelefone(log.recipient_number)}</div>
      <div className="truncate text-[12px] text-red-700">{log.error_message || '—'}</div>
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

// ── Main component ────────────────────────────────────────────────────────────

export default function AutomacoesPageClient() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

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

  const summary  = data?.summary  ?? {};
  const alerts   = data?.alerts   ?? [];
  const failures = data?.recent_failures ?? [];

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
            <div className="flex items-center gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3">
              <span className="text-xl">✅</span>
              <span className="text-[14px] font-semibold text-emerald-700">
                Nenhum alerta crítico encontrado. Tudo parece saudável!
              </span>
            </div>
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
            <div className="flex items-center gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3">
              <span className="text-xl">✅</span>
              <span className="text-[14px] font-semibold text-emerald-700">
                Nenhuma falha recente registrada.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1fr_1.5fr_1fr_1.5fr] gap-1 px-4 pb-1">
                {['Data/hora', 'Regra / origem', 'Destinatário', 'Erro'].map((h) => (
                  <div key={h} className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">{h}</div>
                ))}
              </div>
              {failures.map((log) => (
                <FailureRow key={log.id} log={log} />
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
    </div>
  );
}
