// Segurança: a chave de mapas (paga) nunca pode sair do servidor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('rota pública que devolvia GOOGLE_MAPS_KEY foi removida', () => {
  assert.equal(existsSync('app/api/google/maps-key/route.js'), false);
});

test('GOOGLE_MAPS_KEY só é lida em código de servidor e nunca devolvida em resposta', () => {
  const allowed = new Set(['app/api/quotes/analyze/route.js', 'lib/logistics/google-distance.mjs']);
  const files = [...walk('app'), ...walk('components'), ...walk('lib')].filter((f) => /\.(m?js|jsx|ts|tsx)$/.test(f));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // A chave de NAVEGADOR (autocomplete do contrato) é pública por natureza e deve ser restrita no Google Cloud;
    // só pode existir no layout. A chave de SERVIDOR (rotas/geocodificação pagas) nunca vai ao navegador.
    if (src.includes('NEXT_PUBLIC_GOOGLE_MAPS') && f.replace(/\\/g, '/') !== 'app/layout.tsx') assert.fail(`${f}: chave de mapas exposta ao navegador`);
    if (/NEXT_PUBLIC_GOOGLE_MAPS_KEY\b/.test(src)) assert.fail(`${f}: chave de servidor com prefixo público`);
    if (!/process\.env\.GOOGLE_MAPS_KEY\b/.test(src)) continue;
    assert.ok(allowed.has(f.replace(/\\/g, '/')), `${f}: uso não autorizado de GOOGLE_MAPS_KEY`);
    assert.doesNotMatch(src, /json\(\s*\{[^}]*(apiKey|mapsKey|GOOGLE_MAPS_KEY)/, `${f}: chave em resposta`);
  }
});
