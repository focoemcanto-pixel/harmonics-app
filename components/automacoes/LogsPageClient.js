'use client';

import { useEffect, useState } from 'react';
import AdminSummaryCard from '../admin/AdminSummaryCard';

function formatPhoneDisplay(phone) {
  if (!phone) return '-';
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  return phone;
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }) {
  const styles = {
    sent: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
  };

  const labels = {
    sent: 'Enviado',
    failed: 'Falha',
    pending: 'Pendente',
  };

  const style = styles[status] || styles.pending;
  const label = labels[status] || status;

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-bold ${style}`}>
      {label}
    </span>
  );
}

function LogCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const message = log.rendered_message || '-';
  const shouldTruncate = message.length > 150;

  return (
    <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_8px_20px_rgba(17,24,39,0.03)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={log.status} />
            <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#64748b]">
              {log.source || 'Sistema'}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[#64748b]">Destinatário:</span>
              <span className="text-[14px] font-black text-[#0f172a]">
                {formatPhoneDisplay(log.recipient_number)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[#64748b]">Data/Hora:</span>
              <span className="text-[14px] font-medium text-[#0f172a]">
                {formatDateTime(log.sent_at || log.created_at)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <div className="mb-2 text-[12px] font-bold text-[#64748b]">Mensagem</div>
            <div className="text-[14px] leading-6 text-[#0f172a]">
              {shouldTruncate && !expanded ? (
                <>
                  {message.slice(0, 150)}...
                  <button
                    onClick={() => setExpanded(true)}
                    className="ml-2 text-[13px] font-bold text-violet-600 hover:text-violet-700"
                  >
                    Ver mais
                  </button>
                </>
              ) : (
                <>
                  {message}
                  {shouldTruncate && (
                    <button
                      onClick={() => setExpanded(false)}
                      className="ml-2 text-[13px] font-bold text-violet-600 hover:text-violet-700"
                    >
                      Ver menos
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {log.error_message && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="mb-2 text-[12px] font-bold text-red-800">Erro</div>
              <div className="text-[13px] leading-6 text-red-700">{log.error_message}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LogsPageClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    async function fetchLogs() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/automation/logs');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar logs');
        }

        setLogs(data.logs || []);
      } catch (err) {
        console.error('Erro ao carregar logs:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, []);

  const total = logs.length;
  const sent = logs.filter((log) => log.status === 'sent').length;
  const failed = logs.filter((log) => log.status === 'failed').length;

  if (loading) {
    return (
      <div className="space-y-6">
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

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-[15px] text-[#64748b]">Carregando logs...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
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

        <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="text-center">
            <div className="mb-3 text-[36px]">⚠️</div>
            <h2 className="text-[18px] font-black text-red-800">Erro ao carregar logs</h2>
            <p className="mt-2 text-[14px] text-red-700">{error}</p>
          </div>
        </section>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="space-y-6">
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

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-[48px]">📊</div>
            <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">
              Nenhum log encontrado
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
              Os disparos automáticos aparecerão aqui assim que começarem a ser enviados.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AdminSummaryCard
          label="Total de logs"
          value={String(total)}
          helper="Disparos registrados"
        />
        <AdminSummaryCard
          label="Enviados"
          value={String(sent)}
          helper="Sucesso na entrega"
          tone="success"
        />
        <AdminSummaryCard
          label="Falhas"
          value={String(failed)}
          helper="Erros de envio"
          tone="warning"
        />
      </div>

      {/* Logs List */}
      <div className="space-y-4">
        {logs.map((log) => (
          <LogCard key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
}
