'use client';

import AdminSummaryCard from '../admin/AdminSummaryCard';
import Pill from './EventPill';

export default function EventosResumoTab({
  resumo,
  resumoOperacao,
  eventosFiltrados,
  setDesktopTab,
  setMobileTab,
  setOperacaoFiltro,
  iniciarEdicao,
  formatDateBR,
  getTimelineLabel,
}) {
  const proximosEventos = [...eventosFiltrados]
    .filter((ev) => ev.event_date)
    .sort((a, b) => {
      const aDate = new Date(
        `${a.event_date}T${a.event_time || '00:00:00'}`
      ).getTime();
      const bDate = new Date(
        `${b.event_date}T${b.event_time || '00:00:00'}`
      ).getTime();
      return aDate - bDate;
    })
    .slice(0, 5);

  let saudeLabel = 'Operação sob controle';
  let saudeTone = 'emerald';
  let saudeHelper = 'Nenhuma pendência crítica no momento.';

  if (resumoOperacao.financeiros > 0) {
    saudeLabel = `${resumoOperacao.financeiros} pagamento(s) exigem atenção`;
    saudeTone = 'amber';
    saudeHelper = 'Priorize os eventos com financeiro pendente.';
  } else if (resumoOperacao.contratos > 0) {
    saudeLabel = `${resumoOperacao.contratos} contrato(s) pendentes`;
    saudeTone = 'violet';
    saudeHelper = 'Concluir contratos reduz gargalos da operação.';
  } else if (resumoOperacao.rascunhos > 0) {
    saudeLabel = `${resumoOperacao.rascunhos} evento(s) em rascunho`;
    saudeTone = 'amber';
    saudeHelper = 'Finalize os rascunhos para manter a agenda organizada.';
  } else if (resumoOperacao.proximos > 0) {
    saudeLabel = `${resumoOperacao.proximos} evento(s) nos próximos 7 dias`;
    saudeTone = 'blue';
    saudeHelper = 'Revise detalhes dos eventos mais próximos.';
  }

  return (
    <div className="space-y-5">
      <section
        className={`rounded-[28px] border px-5 py-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:px-6 ${
          saudeTone === 'amber'
            ? 'border-amber-200 bg-amber-50'
            : saudeTone === 'violet'
            ? 'border-violet-200 bg-violet-50'
            : saudeTone === 'blue'
            ? 'border-sky-200 bg-sky-50'
            : 'border-emerald-200 bg-emerald-50'
        }`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-80">
              Saúde da operação
            </div>

            <div className="mt-2 text-[22px] font-black leading-tight text-[#0f172a]">
              {saudeLabel}
            </div>

            <div className="mt-2 text-[14px] font-medium text-[#334155]">
              {saudeHelper}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setOperacaoFiltro('todos');
                setDesktopTab('operacao');
                setMobileTab('lista');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[16px] bg-white px-4 py-3 text-[14px] font-black text-[#0f172a] shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
            >
              Ir para operação
            </button>

            <button
              type="button"
              onClick={() => {
                setDesktopTab('evento');
                setMobileTab('evento');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[16px] border border-white/70 bg-white/50 px-4 py-3 text-[14px] font-black text-[#0f172a]"
            >
              Novo evento
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard
          label="Eventos visíveis"
          value={String(resumo.total)}
          helper="Eventos no recorte atual"
        />
        <AdminSummaryCard
          label="Valor acertado"
          value={resumo.totalAcertadoFormatado}
          helper="Soma dos contratos"
          tone="accent"
        />
        <AdminSummaryCard
          label="Em aberto"
          value={resumo.totalAbertoFormatado}
          helper="Valores ainda pendentes"
          tone="warning"
        />
        <AdminSummaryCard
          label="Lucro previsto"
          value={resumo.totalLucroFormatado}
          helper="Acertado - custos"
          tone="success"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1.3fr]">
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
          <div className="mb-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
              Ações rápidas
            </div>
            <div className="mt-1 text-[20px] font-black text-[#0f172a]">
              Atalhos da operação
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setDesktopTab('evento');
                setMobileTab('evento');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[20px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-4 text-left"
            >
              <div className="text-[14px] font-black text-[#0f172a]">
                Novo evento
              </div>
              <div className="mt-1 text-[13px] font-medium text-[#64748b]">
                Criar um evento rapidamente.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setOperacaoFiltro('financeiro');
                setDesktopTab('operacao');
                setMobileTab('lista');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-left"
            >
              <div className="text-[14px] font-black text-amber-800">
                Resolver pagamentos
              </div>
              <div className="mt-1 text-[13px] font-medium text-amber-700">
                {resumoOperacao.financeiros} pendência(s) financeira(s).
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setOperacaoFiltro('contrato');
                setDesktopTab('operacao');
                setMobileTab('lista');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[20px] border border-violet-200 bg-violet-50 px-4 py-4 text-left"
            >
              <div className="text-[14px] font-black text-violet-700">
                Revisar contratos
              </div>
              <div className="mt-1 text-[13px] font-medium text-violet-700">
                {resumoOperacao.contratos} contrato(s) pendente(s).
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDesktopTab('precos');
                setMobileTab('precos');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[20px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-4 text-left"
            >
              <div className="text-[14px] font-black text-[#0f172a]">
                Ajustar preços
              </div>
              <div className="mt-1 text-[13px] font-medium text-[#64748b]">
                Revisar regras automáticas.
              </div>
            </button>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
                Próximos eventos
              </div>
              <div className="mt-1 text-[20px] font-black text-[#0f172a]">
                Radar da agenda
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setDesktopTab('operacao');
                setMobileTab('lista');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-[13px] font-black text-violet-700"
            >
              Ver operação
            </button>
          </div>

          <div className="space-y-3">
            {proximosEventos.length === 0 ? (
              <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#64748b]">
                Nenhum evento no radar.
              </div>
            ) : (
              proximosEventos.map((ev) => {
                const timeline = getTimelineLabel(ev.event_date);

                return (
                  <div
                    key={ev.id}
                    className="rounded-[22px] border border-[#edf2f7] bg-[#fcfdff] p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-[15px] font-black text-[#0f172a]">
                          {ev.client_name}
                        </div>

                        <div className="mt-1 text-[13px] font-semibold text-[#64748b]">
                          {ev.event_type || 'Evento'}
                        </div>

                        <div className="mt-2 text-[13px] text-slate-700">
                          <strong>Data:</strong> {formatDateBR(ev.event_date)} •{' '}
                          <strong>Hora:</strong> {ev.event_time || '-'}
                        </div>

                        <div className="mt-1 text-[13px] text-slate-500">
                          {ev.location_name || '-'}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Pill tone={timeline.tone}>{timeline.text}</Pill>
                          <Pill tone="default">
                            {ev.status || 'Rascunho'}
                          </Pill>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(ev)}
                          className="rounded-[14px] border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#0f172a]"
                        >
                          Abrir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <div className="mb-4">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
            Atenção agora
          </div>
          <div className="mt-1 text-[20px] font-black text-[#0f172a]">
            O que está travando sua operação
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[20px] bg-amber-50 px-4 py-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-amber-800">
              Financeiro
            </div>
            <div className="mt-1 text-[24px] font-black text-amber-800">
              {resumoOperacao.financeiros}
            </div>
          </div>

          <div className="rounded-[20px] bg-violet-50 px-4 py-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
              Contratos
            </div>
            <div className="mt-1 text-[24px] font-black text-violet-700">
              {resumoOperacao.contratos}
            </div>
          </div>

          <div className="rounded-[20px] bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-700">
              Rascunhos
            </div>
            <div className="mt-1 text-[24px] font-black text-slate-700">
              {resumoOperacao.rascunhos}
            </div>
          </div>

          <div className="rounded-[20px] bg-sky-50 px-4 py-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-sky-700">
              Próximos 7 dias
            </div>
            <div className="mt-1 text-[24px] font-black text-sky-700">
              {resumoOperacao.proximos}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}