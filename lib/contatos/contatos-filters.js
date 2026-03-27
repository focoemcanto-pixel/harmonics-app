'use client';

import { normalizeTag } from './contatos-format';

export function filterBySearchTerm(contatos, searchTerm) {
  const termo = String(searchTerm || '').trim().toLowerCase();
  if (!termo) return contatos;

  return contatos.filter((c) =>
    [c.name, c.email, c.phone, c.tag, c.notes]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(termo))
  );
}

export function filterBySearch(contatos, searchTerm) {
  return filterBySearchTerm(contatos, searchTerm);
}

export function filterByTag(contatos, selectedTag) {
  if (!selectedTag || selectedTag === 'all' || selectedTag === 'todas') return contatos;
  return contatos.filter((c) => normalizeTag(c.tag) === normalizeTag(selectedTag));
}

export function filterByActive(contatos, activeFilter) {
  if (activeFilter === 'all') return contatos;
  if (activeFilter === 'active') return contatos.filter((c) => c.is_active !== false);
  if (activeFilter === 'inactive') return contatos.filter((c) => c.is_active === false);
  return contatos;
}

export function filterByStatus(contatos, status) {
  if (status === 'todos') return contatos;
  const isActive = status === 'ativos';
  return contatos.filter((c) => !!c.is_active === isActive);
}

export function sortContatos(contatos, sortMode) {
  const sorted = [...contatos];

  switch (sortMode) {
    case 'name_asc':
    case 'nome_asc':
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;

    case 'name_desc':
    case 'nome_desc':
      sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      break;

    case 'created_desc':
    case 'recente':
      sorted.sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bDate - aDate;
      });
      break;

    case 'created_asc':
    case 'antigo':
      sorted.sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aDate - bDate;
      });
      break;

    default:
      break;
  }

  return sorted;
}

export function getUniqueTags(contatos) {
  const tags = new Set();
  contatos.forEach((c) => {
    if (c.tag) tags.add(normalizeTag(c.tag));
  });
  return Array.from(tags).sort();
}

export function countByTag(contatos) {
  const counts = {};
  contatos.forEach((c) => {
    if (c.tag) {
      const tag = normalizeTag(c.tag);
      counts[tag] = (counts[tag] || 0) + 1;
    }
  });
  return counts;
}

export function getTagsList(contatos) {
  const counts = countByTag(contatos);
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

export function applyFilters(contatos, { busca, tagFiltro, statusFiltro }) {
  let result = contatos;

  if (busca) {
    result = filterBySearchTerm(result, busca);
  }

  if (tagFiltro && tagFiltro !== 'todas') {
    result = filterByTag(result, tagFiltro);
  }

  if (statusFiltro && statusFiltro !== 'todos') {
    result = filterByStatus(result, statusFiltro);
  }

  return result;
}
