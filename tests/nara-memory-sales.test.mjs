// Memória contextual da cliente (padrão mem0, determinística) e técnicas das sales-skills. Dados sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSignals, applyMemoryOps, isSensitiveValue, formatClientMemory, persistMemory } from '../lib/ai/commercial/memory.mjs';
import { selectStrategies, formatStrategiesForPrompt, STRATEGIES } from '../lib/ai/commercial/strategies.mjs';
import { repeatedObjection } from '../lib/ai/commercial/engine.mjs';
import { buildSystemPrompt } from '../lib/ai/agent/prompt.mjs';

test('sinais comerciais: orçamento, quem decide e prazo — só o que a cliente disse', () => {
  assert.deepEqual(extractSignals('O orçamento está apertado e quem decide comigo é minha mãe.'), { orcamento: 'orcamento esta apertado', decisores: 'mae' });
  assert.equal(extractSignals('Tenho no máximo R$ 2.000 pra música').orcamento, 'no maximo r$ 2.000');
  assert.equal(extractSignals('Vou conversar com meu noivo e te falo').decisores, 'noivo');
  assert.match(extractSignals('Precisamos decidir até sexta').prazo_decisao, /decidir ate sexta/);
  assert.deepEqual(extractSignals('Oi! Quanto fica um trio?'), {});
});

test('privacidade: CPF, cartão e sequências longas de dígitos nunca são memorizados', () => {
  for (const v of ['123.456.789-09', '4111 1111 1111 1111', '12345678909', '12.345.678/0001-90']) assert.equal(isSensitiveValue(v), true, v);
  assert.equal(isSensitiveValue('Igreja Exemplo, 16h'), false);
  const { next, events } = applyMemoryOps({}, { nome: 'Cliente Teste', observacoes: 'CPF 123.456.789-09' });
  assert.equal(next.observacoes, undefined);
  assert.deepEqual(events.map((e) => e.op), ['ADD', 'REJECT_SENSITIVE']);
  assert.equal(events[1].new_value, null, 'nem o valor rejeitado vai para a auditoria');
});

test('persistência isolada por workspace + conversa; rejeitados não são auditados', async () => {
  const calls = [];
  const supabase = { from: (table) => ({
    update: (row) => ({ eq: (k1, v1) => ({ eq: async (k2, v2) => { calls.push({ table, op: 'update', row, filters: { [k1]: v1, [k2]: v2 } }); return { error: null }; } }) }),
    insert: async (rows) => { calls.push({ table, op: 'insert', rows }); return { error: null }; },
  }) };
  const conversation = { id: 'conv-a', lead_data: {} };
  const r = await persistMemory({ supabase, workspaceId: 'ws-a', conversation, updates: { orcamento: 'apertado', observacoes: '4111111111111111' } });
  assert.deepEqual(r.rejected, ['observacoes']);
  assert.deepEqual(calls[0].filters, { id: 'conv-a', workspace_id: 'ws-a' });
  assert.deepEqual(calls[1].rows.map((x) => [x.op, x.key, x.conversation_id, x.workspace_id]), [['ADD', 'orcamento', 'conv-a', 'ws-a']]);
});

test('bloco de memória no prompt: só esta cliente, rótulos legíveis, objeções anteriores, sem dados sensíveis', () => {
  const conversation = { lead_data: { nome: 'Cliente Teste', orcamento: 'apertado', decisores: 'mae', observacoes: '12345678909' }, objections: ['price'] };
  const block = formatClientMemory(conversation);
  assert.match(block, /Nome: Cliente Teste/);
  assert.match(block, /Orçamento \(sinal\): apertado/);
  assert.match(block, /Decide junto com: mae/);
  assert.match(block, /Objeções já levantadas: preço/);
  assert.doesNotMatch(block, /12345678909/);
  const prompt = buildSystemPrompt({ settings: { assistant_name: 'Nara' }, companyName: 'X', conversation });
  assert.match(prompt, /MEMÓRIA DA CLIENTE \(somente desta conversa; nunca mencione outras clientes\)/);
  assert.equal(formatClientMemory({}), 'nenhum dado registrado ainda');
});

test('sales-skills: indecisão gera recomendação única; preço diagnostica antes; repetição para de rebater', () => {
  assert.ok(selectStrategies({ stage: 'qualifying', text: 'Estou entre trio e quarteto e com medo de escolher errado' }).includes('indecision'));
  assert.ok(selectStrategies({ stage: 'qualifying', text: 'tô entre trio e quarteto', enabled: ['discovery'] }).includes('indecision'), 'herdado das estratégias habilitadas');
  assert.match(STRATEGIES.indecision.text, /UMA recomendação clara/);
  assert.match(STRATEGIES.price_objection.text, /Diagnostique ANTES de rebater/);
  assert.match(STRATEGIES.price_objection.textWithoutPayment, /NÃO cite percentuais/);
  assert.equal(repeatedObjection({ objections: ['price'] }, 'continua caro'), 'price');
  assert.equal(repeatedObjection({ objections: [] }, 'achei caro'), null);
  assert.match(formatStrategiesForPrompt(['price_objection'], { repeatedObjection: 'price' }), /repetiu uma objeção/);
  assert.doesNotMatch(formatStrategiesForPrompt(['price_objection']), /repetiu uma objeção/);
});

test('Langfuse: atributos nativos (geração, custo, sessão) e nenhum conteúdo de mensagem', async () => {
  const { replyTraceAttributes, buildOtlpPayload } = await import('../lib/ai/commercial/observability.mjs');
  const attrs = replyTraceAttributes({
    result: { model: 'modelo-x', inputTokens: 100, outputTokens: 20, costUsd: 0.0012, toolCalls: ['calcular_orcamento'] },
    conversation: { id: 'conv-uuid', sales_stage: 'proposal', lead_data: { nome: 'Cliente Teste', orcamento: 'apertado' }, objections: ['price'] },
    commercial: { strategyKeys: ['price_objection'], knowledgeIds: ['k1'], paymentApproved: false }, workspaceId: 'ws', outcome: 'draft',
  });
  assert.equal(attrs['langfuse.observation.type'], 'generation');
  assert.equal(attrs['gen_ai.usage.cost'], 0.0012);
  assert.equal(attrs['session.id'], 'conv-uuid');
  assert.equal(attrs['harmonics.memory_fields'], 2);
  assert.doesNotMatch(JSON.stringify(attrs), /Cliente Teste|apertado/, 'só contagem, nunca o conteúdo da memória');
  const payload = buildOtlpPayload({ name: 'ai.reply', startMs: 1, endMs: 2, attributes: attrs });
  assert.ok(payload.resourceSpans[0].scopeSpans[0].spans[0].attributes.some((a) => a.key === 'gen_ai.usage.cost'));
});

test('memória orienta o uso dos sinais (opção enxuta e resumo para quem decide)', () => {
  const block = formatClientMemory({ lead_data: { nome: 'Cliente Teste', orcamento: 'apertado', decisores: 'mae' } });
  assert.match(block, /Como usar agora: orçamento sensível/);
  assert.match(block, /resumo curto para ela mostrar/);
  assert.doesNotMatch(formatClientMemory({ lead_data: { nome: 'Cliente Teste' } }), /Como usar agora/);
});

test('destinatário de saída: só o número de teste da Meta envia celular BR no formato com 9º dígito', async () => {
  const { outboundRecipient } = await import('../lib/ai/inbox/service.mjs');
  const test = { display_phone: '+1 555-000-0000' };
  assert.equal(outboundRecipient('557188887777', test), '5571988887777', 'wa_id antigo -> formato autorizado na Meta');
  assert.equal(outboundRecipient('5571988887777', test), '5571988887777', 'já com 13 dígitos: inalterado');
  assert.equal(outboundRecipient('557133334444', test), '557133334444', 'fixo (inicia em 3): inalterado');
  assert.equal(outboundRecipient('15550001111', test), '15550001111', 'outro país: inalterado');
  assert.equal(outboundRecipient('557188887777', { display_phone: '+55 71 3000-0000' }), '557188887777', 'canal real: inalterado');
  assert.equal(outboundRecipient('557188887777', {}), '557188887777', 'sem canal identificado: inalterado');
});
