'use client';

export function mapStatus(rawStatus, hasContract) {
  const s = String(rawStatus || '').toLowerCase();

  if (s === 'signed') {
    return {
      key: 'ASSINADO',
      label: 'Assinado',
      tone: 'emerald',
    };
  }

  if (s === 'client_filling') {
    return {
      key: 'PREENCHENDO',
      label: hasContract ? 'Preenchendo' : 'Preenchimento',
      tone: 'violet',
    };
  }

  if (s === 'link_generated') {
    return {
      key: 'LINK_GERADO',
      label: 'Link gerado',
      tone: 'blue',
    };
  }

  return {
    key: 'SEM_STATUS',
    label: 'Sem status',
    tone: 'default',
  };
}

export function getContractStatus(item) {
  return {
    key: item.statusKey,
    label: item.statusLabel,
    tone: item.statusTone,
  };
}

export function getStatusTone(statusKey) {
  switch (statusKey) {
    case 'ASSINADO':
      return 'emerald';
    case 'PREENCHENDO':
      return 'violet';
    case 'LINK_GERADO':
      return 'blue';
    default:
      return 'default';
  }
}
