import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TERMS_MARKDOWN, PRIVACY_MARKDOWN } from '../lib/legal/content.js';
import { LEGAL_DOCUMENTS, validateLegalAcceptance, buildLegalAcceptance } from '../lib/legal/documents.js';
import { parseMarkdown } from '../lib/legal/markdown.js';

const { recordLegalAcceptance } = await import('../lib/legal/record-acceptance.js');

test('textos publicados = docs/legal/*.md e versão do documento = versão registrada no aceite', () => {
  assert.equal(TERMS_MARKDOWN, readFileSync(new URL('../docs/legal/termos-de-uso.md', import.meta.url), 'utf8'), 'rode node scripts/build-legal-content.mjs');
  assert.equal(PRIVACY_MARKDOWN, readFileSync(new URL('../docs/legal/politica-de-privacidade.md', import.meta.url), 'utf8'), 'rode node scripts/build-legal-content.mjs');
  assert.match(TERMS_MARKDOWN, new RegExp(`\\*\\*Versão:\\*\\* ${LEGAL_DOCUMENTS.terms.version}`));
  assert.match(PRIVACY_MARKDOWN, new RegExp(`\\*\\*Versão:\\*\\* ${LEGAL_DOCUMENTS.privacy.version}`));
  assert.match(TERMS_MARKDOWN, /7 \(sete\) dias/);
});

test('documentos legais viram blocos (títulos, listas, tabela, links)', () => {
  const blocks = parseMarkdown(PRIVACY_MARKDOWN);
  assert.equal(blocks[0].type, 'heading');
  assert.ok(blocks.some((b) => b.type === 'table' && b.rows.length >= 5));
  assert.ok(blocks.some((b) => b.type === 'list'));
  const terms = parseMarkdown(TERMS_MARKDOWN);
  assert.ok(terms.some((b) => b.type === 'paragraph' && b.inline.some((p) => p.type === 'link' && p.href === '/privacidade')));
});

test('aceite só vale com as versões vigentes e data plausível', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  assert.equal(validateLegalAcceptance(buildLegalAcceptance(now), now).ok, true);
  assert.equal(validateLegalAcceptance(null, now).reason, 'missing');
  assert.equal(validateLegalAcceptance({ termsVersion: '2020-01-01', privacyVersion: LEGAL_DOCUMENTS.privacy.version, acceptedAt: now.toISOString() }, now).reason, 'outdated_version');
  assert.equal(validateLegalAcceptance({ ...buildLegalAcceptance(now), acceptedAt: 'x' }, now).reason, 'invalid_date');
  assert.equal(validateLegalAcceptance({ ...buildLegalAcceptance(now), acceptedAt: '2026-10-10T00:00:00Z' }, now).reason, 'invalid_date');
});

test('registro do aceite: uma linha por documento com versão, datas, IP e user agent; sem aceite → 400', async () => {
  const calls = [];
  const supabase = {
    from(table) {
      return { upsert: async (rows, opts) => { calls.push({ table, rows, opts }); return { error: null }; } };
    },
  };
  const request = { headers: new Map([['cf-connecting-ip', '203.0.113.9'], ['user-agent', 'TestUA']]) };
  request.headers.get = request.headers.get.bind(request.headers);
  const user = { id: 'u-1', email: 'a@b.test' };

  const ok = await recordLegalAcceptance({ supabase, request, user, acceptance: buildLegalAcceptance(), source: 'test' });
  assert.equal(ok.ok, true);
  assert.equal(calls[0].table, 'legal_acceptances');
  assert.deepEqual(calls[0].rows.map((r) => [r.document, r.version]), [['terms', LEGAL_DOCUMENTS.terms.version], ['privacy', LEGAL_DOCUMENTS.privacy.version]]);
  assert.equal(calls[0].rows[0].ip_address, '203.0.113.9');
  assert.equal(calls[0].rows[0].user_agent, 'TestUA');
  assert.ok(calls[0].rows[0].accepted_at);
  assert.equal(calls[0].opts.onConflict, 'user_id,document,version');

  const missing = await recordLegalAcceptance({ supabase, request, user, acceptance: undefined, source: 'test' });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 400);
  assert.equal(missing.code, 'LEGAL_ACCEPTANCE_REQUIRED');
  assert.equal(calls.length, 1, 'sem aceite não grava nada');
});
