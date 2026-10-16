// Loader de teste: troca o client admin do Supabase e o provider de WhatsApp por dublês
// em memória. Registrado só pelos arquivos de teste que precisam dele (processo isolado
// por arquivo no node --test), nunca em produção. Nenhuma mensagem real é enviada.
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const REDIRECTS = {
  '/lib/supabase-admin.js': pathToFileURL(path.join(here, 'fakes', 'supabase-admin.mjs')).href,
  '/lib/whatsapp/send-whatsapp-message.js': pathToFileURL(path.join(here, 'fakes', 'send-whatsapp-message.mjs')).href,
};

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  for (const [suffix, url] of Object.entries(REDIRECTS)) {
    if (result.url.endsWith(suffix)) return { url, shortCircuit: true };
  }
  return result;
}
