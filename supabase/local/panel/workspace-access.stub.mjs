// Sessão sintética: Owner do workspace de teste, ou anônimo quando x-test-auth=none.
const OWNER = {
  ok: true, userId: '00000000-0000-4000-8000-0000000000e1', email: 'owner@example.test',
  workspaceId: process.env.PANEL_WORKSPACE_ID, role: 'owner', isWorkspaceAdmin: true, canAdminWorkspace: true,
};
function resolve(request) {
  const mode = request?.headers?.get('x-test-auth') || 'owner';
  if (mode === 'none') return { ok: false, status: 401, error: 'Sessão expirada. Faça login novamente.' };
  if (mode === 'viewer') return { ok: false, status: 403, error: 'Apenas administradores.' };
  if (mode === 'admin') return { ...OWNER, userId: '00000000-0000-4000-8000-0000000000e2', role: 'admin' };
  return OWNER;
}
export async function requireWorkspaceAccess({ request }) { return resolve(request); }
export async function requireWorkspaceAdmin({ request }) { return resolve(request); }
