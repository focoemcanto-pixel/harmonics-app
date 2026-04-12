export function isRepertorioTravado(status, isLocked = false) {
  const s = String(status || '').trim().toUpperCase();
  if (isLocked) return true;

  return (
    s === 'ENVIADO' ||
    s === 'ENVIADO_TRANCADO' ||
    s === 'FINALIZADO' ||
    s === 'CONCLUIDO' ||
    s === 'AGUARDANDO_REVISAO'
  );
}
export function parseLocalDate(value) {
  if (!value) return null;

  if (value instanceof Date) return value;

  const s = String(value).trim();

  // formato YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    return new Date(year, month, day);
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;

  return d;
}

export function formatDateBR(value) {
  if (!value) return '—';
  const d = parseLocalDate(value);
  if (!d || Number.isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatLongDateBR(value) {
  if (!value) return '—';
  const d = parseLocalDate(value);
  if (!d || Number.isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function daysUntil(dateValue) {
  if (!dateValue) return null;
  const now = new Date();
  const target = parseLocalDate(dateValue);

  if (!target || Number.isNaN(target.getTime())) return null;

  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();

  return Math.round((startTarget - startNow) / 86400000);
}

export function getRepertorioDeadline(eventDate) {
  if (!eventDate) return null;
  const d = parseLocalDate(eventDate);
if (!d || Number.isNaN(d.getTime())) return null;

  d.setDate(d.getDate() - 15);
  return d;
}

export function getRepertorioUiState({
  status,
  eventDate,
  liberadoParaEdicao,
  isLocked = false,
}) {
  const s = String(status || '').trim().toUpperCase();
  const deadline = getRepertorioDeadline(eventDate);
  const diasPrazo = daysUntil(deadline);

  if (liberadoParaEdicao || s === 'LIBERADO_PARA_EDICAO') {
    return 'liberado';
  }

  if (isRepertorioTravado(s, isLocked)) {
    return 'enviado';
  }

  if ((s === 'NAO_ENVIADO' || !s) && diasPrazo !== null && diasPrazo < 0) {
    return 'atrasado';
  }

  if (s === 'RASCUNHO' && diasPrazo !== null && diasPrazo < 0) {
    return 'atrasado';
  }

  if (s === 'RASCUNHO') {
    return 'rascunho';
  }

  return 'nao_iniciado';
}

export function getRepertorioProgress({
  status,
  etapasPreenchidas,
  totalEtapas,
  isLocked = false,
}) {
  const total = Math.max(1, Number(totalEtapas || 7));
  const preenchidas = Math.max(0, Math.min(total, Number(etapasPreenchidas || 0)));
  const s = String(status || '').trim().toUpperCase();

  if (isRepertorioTravado(s, isLocked)) {
    return { preenchidas: total, total, percentual: 100 };
  }

  const percentual = Math.round((preenchidas / total) * 100);
  return { preenchidas, total, percentual };
}
