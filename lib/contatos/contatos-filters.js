/**
 * Filtros e ordenação de contatos
 */

export function filterBySearch(contatos, searchTerm) {
  const termo = String(searchTerm || '').trim().toLowerCase();
  
  if (!termo) return contatos;
  
  return contatos.filter((c) =>
    [c.name, c.email, c.phone, c.tag, c.notes]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(termo))
  );
}

export function filterByTag(contatos, tag) {
  if (!tag || tag === 'todos') return contatos;
  
  return contatos.filter((c) => {
    const contatoTag = String(c.tag || '').toLowerCase();
    const filterTag = String(tag).toLowerCase();
    return contatoTag.includes(filterTag);
  });
}

export function filterByActive(contatos, onlyActive = false) {
  if (!onlyActive) return contatos;
  
  return contatos.filter((c) => c.is_active !== false);
}

export function sortContatos(contatos, sortMode = 'name') {
  const sorted = [...contatos];
  
  switch (sortMode) {
    case 'name':
      return sorted.sort((a, b) => {
        const nameA = String(a.name || '').toLowerCase();
        const nameB = String(b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    
    case 'recent':
      return sorted.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
    
    case 'tag':
      return sorted.sort((a, b) => {
        const tagA = String(a.tag || '').toLowerCase();
        const tagB = String(b.tag || '').toLowerCase();
        return tagA.localeCompare(tagB);
      });
    
    default:
      return sorted;
  }
}

export function getAvailableTags(contatos) {
  const tags = new Set();
  
  contatos.forEach((c) => {
    if (c.tag) {
      tags.add(String(c.tag).trim());
    }
  });
  
  return Array.from(tags).sort();
}
