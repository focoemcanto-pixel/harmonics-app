'use client';

import AdminSectionTitle from '../admin/AdminSectionTitle';
import Pill from './EventPill';
import OperacaoContractInline from './OperacaoContractInline';

export default function EventosOperacaoTab({
  eventosOperacionais,
  eventosOperacionaisFiltrados,
  resumoOperacao,
  operacaoFiltro,
  setOperacaoFiltro,
  contractsByEventId,
  contratoAbertoId,
  setContratoAbertoId,

  iniciarEdicao,
  confirmarRapido,
  salvarPagamento,

  pagamentoAbertoId,
  setPagamentoAbertoId,
  valorPagamento,
  setValorPagamento,
  salvandoPagamentoId,
  ultimoPagamentoAtualizadoId,

  setDesktopTab,
  setMobileTab,

  getContractStatus,
  getOperacaoAlert,
  getQuickActions,
  getOperacaoPrimaryAction,

  isContratoPendente,
  isFinanceiroPendente,
  isUpcomingEvent,
  isRascunho,

  getTimelineLabel,
  getOperationalTone,
  getPaymentTone,
  getPriorityBannerClasses,

  formatMoney,
  formatDateBR,
  formatPhoneDisplay,
}) {
  const primaryAction = getOperacaoPrimaryAction(resumoOperacao);

  const operacaoTabs = [
    { key: 'todos', label: 'Todos', count: eventosOperacionais.length },
    {
      key: 'contrato',
      label: 'Contratos',
      count: eventosOperacionais.filter((ev) =>
        isContratoPendente(ev, contractsByEventId)
      ).length,
    },
    {
      key: 'financeiro',
      label: 'Financeiro',
      count: eventosOperacionais.filter((ev) => isFinanceiroPendente(ev)).length,
    },
    {
      key: 'proximos',
      label: 'Próximos',
      count: eventosOperacionais.filter((ev) =>
        isUpcomingEvent(ev.event_date, 7)
      ).length,
    },
    {
      key: 'rascunhos',
      label: 'Rascunhos',
      count: eventosOperacionais.filter((ev) => isRascunho(ev)).length,
    },
  ];

  return (
    <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
      <AdminSectionTitle
        title="Operação"
        subtitle="Acompanhe rapidamente os eventos que exigem atenção, contrato, financeiro ou ação imediata."
      />

      <div
        className={`mb-6 rounded-[24px] border px-5 py-5 md:px-6 ${getPriorityBannerClasses(
          resumoOperacao.prioridadeTone
        )}`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-80">
              Prioridade agora
            </div>

            <div className="mt-2 text-[20px] font-black leading-tight">
              {resumoOperacao.prioridadeLabel}
            </div>

            <div className="mt-2 text-[14px] font-medium opacity-80">
              Use os filtros e as ações rápidas abaixo para resolver o que está travando sua operação.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setOperacaoFiltro(primaryAction.filtro);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[16px] bg-white/90 px-4 py-3 text-[14px] font-black text-[#0f172a] shadow-[0_8px_20px_rgba(15,23,42,0.06)] hover:bg-white"
            >
              {primaryAction.label}
            </button>

            <button
              type="button"
              onClick={() => {
                setOperacaoFiltro('todos');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="rounded-[16px] border border-white/60 bg-transparent px-4 py-3 text-[14px] font-black"
            >
              Ver tudo
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[22px] border border-[#e7edf5] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
            Em atenção
          </div>
          <div className="mt-2 text-[28px] font-black text-[#0f172a]">
            {eventosOperacionais.length}
          </div>
          <div className="mt-2 text-[13px] font-medium text-[#64748b]">
            Total de eventos que pedem ação agora.
          </div>
        </div>

        <div className="rounded-[22px] border border-amber-100 bg-amber-50 px-5 py-5 shadow-[0_8px_22px_rgba(245,158,11,0.06)]">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-amber-800">
            Financeiro pendente
          </div>
          <div className="mt-2 text-[28px] font-black text-amber-800">
            {resumoOperacao.financeiros}
          </div>
          <div className="mt-2 text-[13px] font-medium text-amber-700">
            {resumoOperacao.financeiros > 0
              ? 'Pagamentos aguardando ação.'
              : 'Nenhuma pendência financeira.'}
          </div>
        </div>

        <div className="rounded-[22px] border border-violet-100 bg-violet-50 px-5 py-5 shadow-[0_8px_22px_rgba(124,58,237,0.06)]">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
            Contratos pendentes
          </div>
          <div className="mt-2 text-[28px] font-black text-violet-700">
            {resumoOperacao.contratos}
          </div>
          <div className="mt-2 text-[13px] font-medium text-violet-700">
            {resumoOperacao.contratos > 0
              ? 'Eventos sem contrato concluído.'
              : 'Todos os contratos estão em dia.'}
          </div>
        </div>

        <div className="rounded-[22px] border border-sky-100 bg-sky-50 px-5 py-5 shadow-[0_8px_22px_rgba(14,165,233,0.06)]">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-sky-700">
            Próximos 7 dias
          </div>
          <div className="mt-2 text-[28px] font-black text-sky-700">
            {resumoOperacao.proximos}
          </div>
          <div className="mt-2 text-[13px] font-medium text-sky-700">
            {resumoOperacao.proximos > 0
              ? 'Eventos próximos no radar.'
              : 'Nenhum evento iminente.'}
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {operacaoTabs.map((tab) => {
          const active = operacaoFiltro === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setOperacaoFiltro(tab.key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-black transition ${
                active
                  ? 'bg-violet-600 text-white shadow-[0_10px_24px_rgba(124,58,237,0.18)]'
                  : 'bg-[#f8fafc] text-[#475569] hover:bg-[#eef2ff]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  active ? 'bg-white/20 text-white' : 'bg-white text-[#0f172a]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {eventosOperacionaisFiltrados.length === 0 ? (
          <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#64748b]">
            Nenhum evento encontrado neste filtro operacional.
          </div>
        ) : (
          eventosOperacionaisFiltrados.map((ev) => {
            const timeline = getTimelineLabel(ev.event_date);
            const alerta = getOperacaoAlert(ev, contractsByEventId);
            const actions = getQuickActions(ev, contractsByEventId);
            const contractStatus = getContractStatus(ev, contractsByEventId);
            const contractInfo = contractsByEventId.get(String(ev.id));
            const pagamentoRecemAtualizado =
              ultimoPagamentoAtualizadoId === ev.id;

            return (
              <div
                key={ev.id}
                className={`overflow-hidden rounded-[28px] border shadow-[0_8px_20px_rgba(17,24,39,0.035)] transition-all duration-300 ${
                  pagamentoRecemAtualizado
                    ? 'ring-2 ring-emerald-300 ring-offset-2'
                    : ''
                } ${alerta.cardClass}`}
              >
                <div className={`h-1.5 w-full ${alerta.stripeClass}`} />

                <div className="px-4 pb-4 pt-3 md:px-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#334155] backdrop-blur">
                      {alerta.label}
                    </span>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => iniciarEdicao(ev)}
                        className="rounded-full border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#0f172a] hover:bg-[#f8fafc]"
                      >
                        Editar
                      </button>

                     <button
  type="button"
  onClick={() => {
  setPagamentoAbertoId(null);
  setContratoAbertoId((prev) => (prev === ev.id ? null : ev.id));
}}
  className={`rounded-full border px-3 py-2 text-[12px] font-black ${
    contractStatus.action === 'create'
      ? 'border-slate-200 bg-slate-100 text-[#0f172a]'
      : contractStatus.action === 'edit'
      ? 'border-violet-200 bg-violet-50 text-violet-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }`}
>
  {contractStatus.action === 'create' && 'Gerar contrato'}
  {contractStatus.action === 'edit' && 'Finalizar contrato'}
  {contractStatus.action === 'view' && 'Ver contrato'}
</button>

                      {actions.canConfirm && (
                        <button
                          type="button"
                          onClick={() => confirmarRapido(ev)}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-black text-emerald-700 hover:bg-emerald-100"
                        >
                          Confirmar
                        </button>
                      )}

                      {actions.canRegisterPayment && (
                        <button
                          type="button"
                          onClick={() => {
  setValorPagamento('');
  setContratoAbertoId(null);
  setPagamentoAbertoId((prev) => (prev === ev.id ? null : ev.id));
}}
                          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-black text-amber-700 hover:bg-amber-100"
                        >
                          Pagamento
                        </button>
                      )}
                    </div>
                  </div>

                  {ultimoPagamentoAtualizadoId === ev.id && (
                    <div className="mb-4 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-700">
                      Pagamento atualizado com sucesso.
                    </div>
                  )}

                  <div className="rounded-[22px] bg-white/70 p-4 backdrop-blur md:p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-[18px] font-black text-[#0f172a]">
                          {ev.client_name}
                        </div>

                        <div className="mt-1 text-[13px] font-semibold text-[#64748b]">
                          {ev.event_type || 'Evento'}
                        </div>

                        <div className="mt-3 text-[13px] text-slate-700">
                          <strong>Data:</strong> {formatDateBR(ev.event_date)} •{' '}
                          <strong>Hora:</strong> {ev.event_time || '-'} •{' '}
                          <strong>Local:</strong> {ev.location_name || '-'}
                        </div>

                        <div className="mt-2 text-[13px] text-slate-700">
                          <strong>Formação:</strong> {ev.formation || '-'} •{' '}
                          <strong>Som:</strong> {ev.has_sound ? 'Sim' : 'Não'}
                        </div>

                        <div className="mt-2 text-[12px] text-slate-500">
                          {ev.whatsapp_name || '-'}
                          {ev.whatsapp_phone
                            ? ` • ${formatPhoneDisplay(ev.whatsapp_phone)}`
                            : ''}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Pill tone={timeline.tone}>{timeline.text}</Pill>

                          <Pill tone={getOperationalTone(ev.status)}>
                            {`Status: ${ev.status || 'Rascunho'}`}
                          </Pill>

                          <Pill tone={getPaymentTone(ev.payment_status || 'Pendente')}>
                            {`Financeiro: ${ev.payment_status || 'Pendente'}`}
                          </Pill>

                          <Pill tone={contractStatus.tone || 'default'}>
                            {`Contrato: ${contractStatus.label}`}
                          </Pill>
                        </div>
                      </div>

                      <div className="w-full md:w-[240px]">
                        <div className="rounded-[18px] bg-white/80 p-4 text-[13px] text-slate-700">
                          <div>
                            <strong>Acertado:</strong>{' '}
                            {formatMoney(ev.agreed_amount)}
                          </div>
                          <div className="mt-1">
                            <strong>Quitado:</strong>{' '}
                            {formatMoney(ev.paid_amount)}
                          </div>
                          <div className="mt-1 font-semibold text-amber-600">
                            Em aberto: {formatMoney(ev.open_amount)}
                          </div>
                          <div className="mt-1 font-semibold text-emerald-600">
                            Lucro: {formatMoney(ev.profit_amount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {contratoAbertoId === ev.id && (
  <OperacaoContractInline
    ev={ev}
    contractStatus={contractStatus}
    contractInfo={contractInfo}
    onOpenLink={() => {
      if (contractInfo?.link) {
        window.open(contractInfo.link, '_blank');
      }
    }}
    onCreateOrEdit={() => {
      iniciarEdicao(ev);
      setDesktopTab('evento');
      setMobileTab('evento');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }}
  />
)}

                  {pagamentoAbertoId === ev.id && (
                    <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 p-4">
                      <div className="mb-2 text-[13px] font-bold text-amber-800">
                        Registrar pagamento
                      </div>

                      <input
                        type="number"
                        placeholder="Valor"
                        value={valorPagamento}
                        onChange={(e) => setValorPagamento(e.target.value)}
                        className="mb-3 w-full rounded-[12px] border border-[#dbe3ef] px-3 py-2 text-sm"
                      />

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => salvarPagamento(ev, 'total')}
                          disabled={salvandoPagamentoId === ev.id}
                          className="rounded-[12px] bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                        >
                          {salvandoPagamentoId === ev.id
                            ? 'Salvando...'
                            : 'Quitar total'}
                        </button>

                        <button
                          type="button"
                          onClick={() => salvarPagamento(ev, 'parcial')}
                          disabled={salvandoPagamentoId === ev.id}
                          className="rounded-[12px] bg-amber-500 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                        >
                          {salvandoPagamentoId === ev.id
                            ? 'Salvando...'
                            : 'Parcial'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPagamentoAbertoId(null);
                            setValorPagamento('');
                          }}
                          disabled={salvandoPagamentoId === ev.id}
                          className="rounded-[12px] border border-[#dbe3ef] px-4 py-2 text-sm font-black disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}