export function isContratoPendente(ev, contractsByEventId) {
  const contractInfo = contractsByEventId.get(String(ev.id));
  return !contractInfo || contractInfo.label !== 'Contrato assinado';
}

export function isFinanceiroPendente(ev) {
  return ev.payment_status === 'Pendente' || ev.payment_status === 'Parcial';
}

export function isRascunho(ev) {
  return (ev.status || '').toLowerCase() === 'rascunho';
}

export function isAntesalaPendente(ev) {
  return (
    Boolean(ev?.antesala_requested_by_client) &&
    String(ev?.antesala_request_status || '')
      .trim()
      .toLowerCase() === 'pending'
  );
}

export function getOperacaoAlert(ev, contractsByEventId) {
  if (isAntesalaPendente(ev)) {
    return {
      label: 'Atenção: solicitação de antesala pendente',
      tone: 'amber',
      cardClass: 'border-amber-300 bg-amber-50/60',
      stripeClass: 'bg-amber-600',
    };
  }

  if (isFinanceiroPendente(ev)) {
    return {
      label: 'Atenção: financeiro pendente',
      tone: 'amber',
      cardClass: 'border-amber-200 bg-amber-50/40',
      stripeClass: 'bg-amber-500',
    };
  }

  if (isContratoPendente(ev, contractsByEventId)) {
    return {
      label: 'Atenção: contrato não concluído',
      tone: 'violet',
      cardClass: 'border-violet-200 bg-violet-50/40',
      stripeClass: 'bg-violet-500',
    };
  }

  return {
    label: 'Em atenção',
    tone: 'default',
    cardClass: 'border-[#dbe3ef] bg-white',
    stripeClass: 'bg-[#cbd5e1]',
  };
}

export function getQuickActions(ev) {
  const operational = String(ev.status || '').toLowerCase();
  const payment = String(ev.payment_status || '').toLowerCase();

  return {
    canConfirm: operational !== 'confirmado',
    canRegisterPayment: payment === 'pendente' || payment === 'parcial',
  };
}

export function getOperacaoPrimaryAction(resumoOperacao) {
  if (resumoOperacao.financeiros > 0) {
    return { label: 'Resolver pagamentos', filtro: 'financeiro' };
  }

  if (resumoOperacao.contratos > 0) {
    return { label: 'Revisar contratos', filtro: 'contrato' };
  }

  if (resumoOperacao.rascunhos > 0) {
    return { label: 'Finalizar rascunhos', filtro: 'rascunhos' };
  }

  if (resumoOperacao.proximos > 0) {
    return { label: 'Ver próximos eventos', filtro: 'proximos' };
  }

  return { label: 'Ver tudo', filtro: 'todos' };
}
