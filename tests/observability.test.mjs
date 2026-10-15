import test from 'node:test';
import assert from 'node:assert/strict';
import { NextResponse } from 'next/server.js';

const { withApiObservability, attachAuthContext } = await import('../lib/observability/api-observability.js');

function capture() {
  const lines = [];
  const original = { info: console.info, warn: console.warn, error: console.error };
  for (const level of ['info', 'warn', 'error']) console[level] = (line) => lines.push(JSON.parse(line));
  return { lines, restore: () => Object.assign(console, original) };
}

test('loga rota, status, latência, usuário, workspace e código de erro; devolve x-request-id', async () => {
  const cap = capture();
  const handler = withApiObservability(async (request) => {
    attachAuthContext(request, { userId: 'user-1', workspaceId: 'ws-1' });
    return NextResponse.json({ ok: false, code: 'PLAN_LIMIT_REACHED', message: 'limite' }, { status: 402 });
  }, { route: '/api/events' });
  const response = await handler(new Request('https://app.test/api/events', { method: 'POST', headers: { 'x-request-id': 'req-abc-123' } }));
  cap.restore();
  assert.equal(response.status, 402);
  assert.equal(response.headers.get('x-request-id'), 'req-abc-123');
  const [line] = cap.lines;
  assert.equal(line.type, 'api_request');
  assert.equal(line.route, '/api/events');
  assert.equal(line.method, 'POST');
  assert.equal(line.status, 402);
  assert.equal(line.userId, 'user-1');
  assert.equal(line.workspaceId, 'ws-1');
  assert.equal(line.code, 'PLAN_LIMIT_REACHED');
  assert.equal(typeof line.durationMs, 'number');
});

test('exceção vira 500 com requestId, sem vazar detalhes internos ao cliente', async () => {
  const cap = capture();
  const handler = withApiObservability(async () => { throw new Error('relation "x" does not exist'); }, { route: '/api/x' });
  const response = await handler(new Request('https://app.test/api/x'));
  cap.restore();
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.ok(body.requestId);
  assert.ok(!JSON.stringify(body).includes('relation'));
  assert.equal(cap.lines[0].error.message, 'relation "x" does not exist');
});
