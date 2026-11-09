/** Ações reservadas ao Owner do workspace (autonomia, tabelas oficiais). */
export function isWorkspaceOwner(auth) {
  return String(auth?.role || '').toLowerCase() === 'owner';
}
export const AUTONOMY_CONFIRMATION = 'LIBERAR AUTONOMIA';
