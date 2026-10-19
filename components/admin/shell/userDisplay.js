export function getInitials(name) {
  if (!name) return '?';
  return String(name).trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export function normalizeRoleLabel(role) {
  const value = String(role || '').toLowerCase();
  const labels = {
    owner: 'Owner',
    admin: 'Admin',
    financeiro: 'Financeiro',
    operacional: 'Operacional',
    editor: 'Editor',
    viewer: 'Visualizador',
  };
  return labels[value] || value || 'Membro';
}
