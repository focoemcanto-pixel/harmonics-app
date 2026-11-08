// Loader de teste: troca SOMENTE o cliente Supabase (→ Postgres local) e a resolução de sessão
// (→ Owner sintético). Todo o resto (rotas, guards, RPCs, RLS de privilégios) é o código real.
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const STUBS = {
  '@/lib/supabase-admin': 'supabase-admin.stub.mjs',
  '@/lib/api/require-workspace-access': 'workspace-access.stub.mjs',
};

export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: pathToFileURL(path.join(here, STUBS[specifier])).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
