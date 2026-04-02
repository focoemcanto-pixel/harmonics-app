'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import AutomationBackLink from '@/components/automacoes/AutomationBackLink';

const MESSAGE_PREVIEW_LENGTH = 120;

function formatarData(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarTelefone(numero) {
  if (!numero) return '-';
  const digits = numero.replace(/\D/g, '');
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return numero;
}

function StatusBadge({ status }) {
  if (status === 'sent') {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
        Enviado
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-bold text-red-700">
        Falha
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-700">
      Pendente
    </span>
  );
}

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

// ---------- Toast simples ----------
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

// ---------- Modal de detalhes do log ----------
function LogDetailModal({ log, onClose, onRetrySuccess }) {
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [toast, setToast] = useState(null);

  function handleCopy() {
    if (!log.rendered_message) return;
    navigator.clipboard.writeText(log.rendered_message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch('/api/automation/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: log.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao fazer retry');
      setToast({ message: 'Retry executado com sucesso!', type: 'success' });
      onRetrySuccess();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px] sm:m-4 max-h-[92vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">
              Detalhes do log
            </h2>
            <p className="mt-0.5 text-[12px] text-[#94a3b8] font-mono">{log.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={log.status} />
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569]"
              aria-label="Fechar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#f8fafc] p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Destinatário</div>
              <div className="mt-1 text-[13px] font-semibold text-[#0f172a]">{formatarTelefone(log.recipient_number)}</div>
            </div>
            <div className="rounded-xl bg-[#f8fafc] p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Origem</div>
              <div className="mt-1 text-[13px] font-semibold text-[#0f172a]">{log.source || '-'}</div>
            </div>
            <div className="rounded-xl bg-[#f8fafc] p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Data/hora</div>
              <div className="mt-1 text-[13px] font-semibold text-[#0f172a]">{formatarData(log.sent_at || log.created_at)}</div>
            </div>
            {log.rule_id && (
              <div className="rounded-xl bg-[#f8fafc] p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Rule ID</div>
                <div className="mt-1 truncate font-mono text-[12px] text-[#475569]">{log.rule_id}</div>
              </div>
            )}
            {log.template_id && (
              <div className="rounded-xl bg-[#f8fafc] p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Template ID</div>
                <div className="mt-1 truncate font-mono text-[12px] text-[#475569]">{log.template_id}</div>
              </div>
            )}
            {log.channel_id && (
              <div className="rounded-xl bg-[#f8fafc] p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#94a3b8]">Channel ID</div>
                <div className="mt-1 truncate font-mono text-[12px] text-[#475569]">{log.channel_id}</div>
              </div>
            )}
          </div>

          {/* Mensagem enviada */}
          {log.rendered_message && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-bold text-[#0f172a]">Mensagem enviada</label>
                <button
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold transition ${
                    copied
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]'
                  }`}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? 'Copiado!' : 'Copiar mensagem'}
                </button>
              </div>
              <div className="mt-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[13px] leading-relaxed text-[#475569] whitespace-pre-wrap">
                {log.rendered_message}
              </div>
            </div>
          )}

          {/* Erro */}
          {log.error_message && (
            <div>
              <label className="text-[13px] font-bold text-[#0f172a]">Mensagem de erro</label>
              <div className="mt-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 whitespace-pre-wrap">
                {log.error_message}
              </div>
            </div>
          )}

          {/* Metadata */}
          {log.metadata && (
            <div>
              <label className="text-[13px] font-bold text-[#0f172a]">Metadata (payload)</label>
              <pre className="mt-1.5 overflow-auto rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[11px] leading-relaxed text-[#475569] max-h-36">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Provider response */}
          {log.provider_response && (
            <div>
              <label className="text-[13px] font-bold text-[#0f172a]">Resposta do provider</label>
              <pre className="mt-1.5 overflow-auto rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[11px] leading-relaxed text-[#475569] max-h-36">
                {JSON.stringify(log.provider_response, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {log.status === 'failed' && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="rounded-full bg-amber-500 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {retrying ? 'Tentando...' : '🔄 Tentar novamente'}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full border border-[#e2e8f0] px-5 py-2.5 text-[14px] font-bold text-[#475569] transition hover:bg-[#f8fafc]"
          >
            Fechar
          </button>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

// ---------- Card de log na lista ----------
function LogCard({ log, onVerDetalhes, onRetrySuccess }) {
  const [retrying, setRetrying] = useState(false);
  const [toast, setToast] = useState(null);

  async function handleRetry(e) {
    e.stopPropagation();
    setRetrying(true);
    try {
      const res = await fetch('/api/automation/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: log.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao fazer retry');
      setToast({ message: 'Retry executado com sucesso!', type: 'success' });
      onRetrySuccess();
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setRetrying(false);
    }
  }

  const preview =
    log.rendered_message && log.rendered_message.length > MESSAGE_PREVIEW_LENGTH
      ? log.rendered_message.substring(0, MESSAGE_PREVIEW_LENGTH) + '...'
      : log.rendered_message || '';

  return (
    <div className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {/* Status + source */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={log.status} />
            {log.source && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                {log.source}
              </span>
            )}
            {log.recipient_type && (
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">
                {log.recipient_type}
              </span>
            )}
          </div>

          {/* Número destinatário */}
          <div className="mt-1.5 text-[14px] font-bold text-[#0f172a]">
            {formatarTelefone(log.recipient_number)}
          </div>

          {/* Mensagem */}
          {log.rendered_message && (
            <p className="mt-2 text-[13px] leading-relaxed text-[#475569]">{preview}</p>
          )}

          {/* Erro */}
          {log.error_message && (
            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              <span className="font-bold">Erro:</span> {log.error_message}
            </div>
          )}

          {/* Data */}
          <div className="mt-2 text-[12px] text-[#94a3b8]">
            {formatarData(log.sent_at || log.created_at)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {log.status === 'failed' && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {retrying ? 'Tentando...' : '🔄 Tentar novamente'}
            </button>
          )}
          <button
            onClick={() => onVerDetalhes(log)}
            className="rounded-full border border-[#e2e8f0] px-3 py-1.5 text-[12px] font-bold text-[#475569] transition hover:bg-[#f8fafc]"
          >
            Ver detalhes
          </button>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

// ---------- Componente principal ----------
export default function LogsPageClient() {
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [logSelecionado, setLogSelecionado] = useState(null);

  // Filtros — inicializar a partir de query params da URL (ex: ?status=failed)
  const [filtroStatus, setFiltroStatus] = useState(() => searchParams.get('status') || '');
  const [filtroRecipient, setFiltroRecipient] = useState(() => searchParams.get('recipient') || '');
  const [filtroSource, setFiltroSource] = useState(() => searchParams.get('source') || '');

  // Sincronizar filtros quando os query params mudarem (ex: navegação via browser)
  useEffect(() => {
    setFiltroStatus(searchParams.get('status') || '');
    setFiltroRecipient(searchParams.get('recipient') || '');
    setFiltroSource(searchParams.get('source') || '');
  }, [searchParams]);

  const carregarLogs = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const params = new URLSearchParams();
      if (filtroStatus) params.set('status', filtroStatus);
      if (filtroRecipient) params.set('recipient', filtroRecipient);
      if (filtroSource) params.set('source', filtroSource);

      const response = await fetch(`/api/automation/logs?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar logs');
      }

      setLogs(data.logs || []);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, [filtroStatus, filtroRecipient, filtroSource]);

  useEffect(() => {
    carregarLogs();
  }, [carregarLogs]);

  function limparFiltros() {
    setFiltroStatus('');
    setFiltroRecipient('');
    setFiltroSource('');
  }

  const temFiltros = filtroStatus || filtroRecipient || filtroSource;

  const stats = logs.reduce(
    (acc, l) => {
      acc.total += 1;
      if (l.status === 'sent') acc.enviados += 1;
      if (l.status === 'failed') acc.falhas += 1;
      return acc;
    },
    { total: 0, enviados: 0, falhas: 0 }
  );
  const { total, enviados, falhas } = stats;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <AutomationBackLink />
      </div>

      {/* Hero Section */}
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
          Logs
        </div>
        <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">
          Logs de Automação
        </h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
          Acompanhe o histórico dos disparos, identifique falhas e monitore o comportamento das mensagens automáticas.
        </p>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-3 gap-4">
        <AdminSummaryCard label="Total" value={carregando ? '–' : total} tone="default" />
        <AdminSummaryCard label="Enviados" value={carregando ? '–' : enviados} tone="success" />
        <AdminSummaryCard label="Falhas" value={carregando ? '–' : falhas} tone="warning" />
      </section>

      {/* Filtros */}
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="flex flex-wrap items-end gap-3">
          {/* Status */}
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Status</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-[13px] text-[#0f172a] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            >
              <option value="">Todos</option>
              <option value="sent">Enviado</option>
              <option value="failed">Falha</option>
              <option value="skipped">Ignorado</option>
            </select>
          </div>

          {/* Telefone */}
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Buscar telefone</label>
            <input
              type="text"
              value={filtroRecipient}
              onChange={(e) => setFiltroRecipient(e.target.value)}
              placeholder="Ex: 5511..."
              className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-[13px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {/* Origem */}
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Origem</label>
            <select
              value={filtroSource}
              onChange={(e) => setFiltroSource(e.target.value)}
              className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-[13px] text-[#0f172a] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            >
              <option value="">Todas</option>
              <option value="automation_center">automation_center</option>
              <option value="legacy_send_invite">legacy_send_invite</option>
              <option value="legacy_contract_signed">legacy_contract_signed</option>
            </select>
          </div>

          {/* Limpar filtros */}
          {temFiltros && (
            <button
              onClick={limparFiltros}
              className="rounded-xl border border-[#e2e8f0] px-4 py-2 text-[13px] font-bold text-[#475569] transition hover:bg-[#f8fafc]"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </section>

      {/* Loading */}
      {carregando && (
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mx-auto flex max-w-xs flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="text-[14px] font-semibold text-[#64748b]">Carregando logs...</p>
          </div>
        </section>
      )}

      {/* Error */}
      {!carregando && erro && (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mb-2 text-[32px]">⚠️</div>
          <p className="text-[15px] font-bold text-red-700">{erro}</p>
          <button
            onClick={carregarLogs}
            className="mt-4 rounded-full border border-red-300 px-5 py-2 text-[13px] font-bold text-red-700 transition hover:bg-red-100"
          >
            Tentar novamente
          </button>
        </section>
      )}

      {/* Empty State */}
      {!carregando && !erro && logs.length === 0 && (
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-[48px]">📊</div>
            <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">
              {temFiltros ? 'Nenhum log com esses filtros' : 'Nenhum disparo registrado'}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
              {temFiltros
                ? 'Tente ajustar ou limpar os filtros.'
                : 'Os logs dos disparos automáticos aparecerão aqui assim que o sistema começar a enviar mensagens.'}
            </p>
            {temFiltros && (
              <button
                onClick={limparFiltros}
                className="mt-4 rounded-full border border-[#e2e8f0] px-5 py-2 text-[13px] font-bold text-[#475569] transition hover:bg-[#f8fafc]"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </section>
      )}

      {/* Logs List */}
      {!carregando && !erro && logs.length > 0 && (
        <section className="space-y-4">
          {logs.map((log) => (
            <LogCard
              key={log.id}
              log={log}
              onVerDetalhes={setLogSelecionado}
              onRetrySuccess={carregarLogs}
            />
          ))}
        </section>
      )}

      {/* Modal de detalhes */}
      {logSelecionado && (
        <LogDetailModal
          log={logSelecionado}
          onClose={() => setLogSelecionado(null)}
          onRetrySuccess={() => {
            setLogSelecionado(null);
            carregarLogs();
          }}
        />
      )}
    </div>
  );
}
