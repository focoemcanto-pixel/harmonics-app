'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';

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

function LogCard({ log }) {
  const [expandido, setExpandido] = useState(false);
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
            <div className="mt-2">
              <p className="text-[13px] leading-relaxed text-[#475569]">
                {expandido ? log.rendered_message : preview}
              </p>
              {log.rendered_message.length > MESSAGE_PREVIEW_LENGTH && (
                <button
                  onClick={() => setExpandido((v) => !v)}
                  className="mt-1 text-[12px] font-bold text-violet-600 hover:text-violet-800"
                >
                  {expandido ? 'Ver menos' : 'Ver mais'}
                </button>
              )}
            </div>
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
      </div>
    </div>
  );
}

export default function LogsPageClient() {
  const [logs, setLogs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregarLogs = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const response = await fetch('/api/automation/logs');
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
  }, []);

  useEffect(() => {
    carregarLogs();
  }, [carregarLogs]);

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
              Nenhum disparo registrado
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
              Os logs dos disparos automáticos aparecerão aqui assim que o sistema começar a enviar mensagens.
            </p>
          </div>
        </section>
      )}

      {/* Logs List */}
      {!carregando && !erro && logs.length > 0 && (
        <section className="space-y-4">
          {logs.map((log) => (
            <LogCard key={log.id} log={log} />
          ))}
        </section>
      )}
    </div>
  );
}
