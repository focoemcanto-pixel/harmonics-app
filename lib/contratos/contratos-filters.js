'use client';

export function filterBySearch(contratos, searchTerm) {
  const q = String(searchTerm || '').trim().toLowerCase();

  if (!q) return contratos;

  return contratos.filter((item) =>
    String(item.clienteNome || '').toLowerCase().includes(q) ||
    String(item.eventoTitulo || '').toLowerCase().includes(q) ||
    String(item.token || '').toLowerCase().includes(q) ||
    String(item.localEvento || '').toLowerCase().includes(q)
  );
}

export function filterByStatus(contratos, statusKey) {
  if (!statusKey || statusKey === 'todos') return contratos;

  return contratos.filter((item) => item.statusKey === statusKey);
}

export function sortContratos(contratos, sortMode = 'recent') {
  const sorted = [...contratos];

  switch (sortMode) {
    case 'recent':
      return sorted.sort((a, b) => {
        const dateA = a.enviadoEm ? new Date(a.enviadoEm).getTime() : 0;
        const dateB = b.enviadoEm ? new Date(b.enviadoEm).getTime() : 0;
        return dateB - dateA;
      });

    case 'cliente':
      return sorted.sort((a, b) => {
        const nameA = String(a.clienteNome || '').toLowerCase();
        const nameB = String(b.clienteNome || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

    default:
      return sorted;
  }
}
