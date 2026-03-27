// lib/contatos/contatos-filters.js
'use client';

import { normalizeTag } from './contatos-format';

/**
 * Filtra contatos por termo de busca
 */
export function filterBySearch(contatos, searchTerm) {
  if (!searchTerm) return contatos;

  const termo = searchTerm.toLowerCase().trim();

  return contatos.filter((c) =>
    [c.name, c.email, c.phone, c.tag, c.notes]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(termo))
  );
}

/**
 * Filtra contatos por tag
 */
export function filterByTag(contatos, tag) {
  if (!tag || tag === 'todos') return contatos;

  const normalizedFilter = normalizeTag(tag);

  return contatos.filter((c) => {
    const contatoTag = normalizeTag(c.tag);
    return contatoTag === normalizedFilter;
  });
}

/**
 * Filtra contatos ativos/inativos
 */
export function filterByStatus(contatos, status) {
  if (status === 'todos') return contatos;
  
  const isActive = status === 'ativos';
  
  return contatos.filter((c) => !!c.is_active === isActive);
}

/**
 * Ordena contatos por critério
 */
export function sortContatos(contatos, sortMode) {
  const lista = [...contatos];

  switch (sortMode) {
    case 'nome_asc':
      return lista.sort((a, b) => 
        String(a.name || '').localeCompare(String(b.name || ''))
      );
    
    case 'nome_desc':
      return lista.sort((a, b) => 
        String(b.name || '').localeCompare(String(a.name || ''))
      );
    
    case 'recente':
      return lista.sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bDate - aDate;
      });
    
    case 'antigo':
      return lista.sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aDate - bDate;
      });
    
    default:
      return lista;
  }
}

/**
 * Extrai tags únicas da lista de contatos
 */
export function getUniqueTags(contatos) {
  const tags = new Set();
  
  contatos.forEach((c) => {
    if (c.tag) {
      tags.add(normalizeTag(c.tag));
    }
  });
  
  return Array.from(tags).sort();
}

/**
 * Conta contatos por tag
 */
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

/**
 * Retorna lista de tags com contagem, ordenada alfabeticamente
 */
export function getTagsList(contatos) {
  const counts = countByTag(contatos);
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * Aplica todos os filtros de uma vez (busca, tag, status)
 */
export function applyFilters(contatos, { busca, tagFiltro, statusFiltro }) {
  let result = contatos;

  if (busca) {
    result = filterBySearch(result, busca);
  }

  if (tagFiltro && tagFiltro !== 'todas') {
    result = filterByTag(result, tagFiltro);
  }

  if (statusFiltro && statusFiltro !== 'todos') {
    result = filterByStatus(result, statusFiltro);
  }

  return result;
}
