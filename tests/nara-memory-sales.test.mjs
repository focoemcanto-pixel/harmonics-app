// Memória contextual da cliente (padrão mem0, determinística) e técnicas das sales-skills. Dados sintéticos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSignals, applyMemoryOps, isSensitiveValue, formatClientMemory, persistMemory, MEMORY_FIELDS } from '../lib/ai/commercial/memory.mjs';
const MEMORY_FIELDS_INCLUDES = (k) => MEMORY_FIELDS.includes(k);
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
  assert.match(prompt, /FATOS ATUAIS \(esta conversa/);
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

test('localidade: nunca aplica preço da região-base a outra região; sinaliza parametrização', async () => {
  const { calculateQuote, hasRegionIssue } = await import('../lib/ai/commercial/pricing.mjs');
  const rules = [
    { category: 'ceremony', item_key: 'trio', amount: 1500, valid_from: '2090-01-01' },
    { category: 'ceremony', item_key: 'trio@metro', amount: 2100, valid_from: '2090-01-01' },
    { category: 'transport', item_key: 'standard_trip', amount: 150, valid_from: '2090-01-01' },
  ];
  const areas = [
    { name: 'Cidade Base', match_terms: ['cidade base'], status: 'served', active: true },
    { name: 'Cidade Metro', match_terms: ['cidade metro'], status: 'served', active: true, price_tier: 'metro' },
    { name: 'Cidade Sem Faixa', match_terms: ['cidade sem faixa'], status: 'served', active: true, price_tier: 'ate120' },
  ];
  const q = (location) => calculateQuote({ date: '2090-03-01', formation: 'Trio', location }, { rules, areas });
  const base = q('Cidade Base');
  assert.equal(base.items.find((i) => i.key === 'ceremony').amount, 1500);
  assert.equal(hasRegionIssue(base), false);
  const metro = q('Espaço Exemplo, Cidade Metro');
  assert.deepEqual(metro.items.map((i) => [i.key, i.amount]), [['ceremony', 2100], ['travel', 150]], 'faixa própria + locomoção');
  const semFaixa = q('Cidade Sem Faixa');
  assert.equal(semFaixa.items.find((i) => i.key === 'ceremony'), undefined, 'faixa sem preço próprio não cai na base');
  assert.equal(hasRegionIssue(semFaixa), true);
  const desconhecida = q('Município Não Cadastrado');
  assert.equal(desconhecida.items.find((i) => i.key === 'ceremony'), undefined, 'local sem área: sem preço base');
  assert.ok(desconhecida.approvals.includes('region_not_parameterized'));
});

test('tabela padrão por localidade: base, faixa com aviso de locomoção e região não parametrizada', async () => {
  const { executeTool } = await import('../lib/ai/agent/tools.mjs');
  const inserts = [];
  const tables = {
    quote_price_rules: [
      { workspace_id: 'w', category: 'ceremony', item_key: 'duo', amount: 1000, valid_from: '2090-01-01' },
      { workspace_id: 'w', category: 'ceremony', item_key: 'duo@metro', amount: 1400, valid_from: '2090-01-01' },
    ],
    ai_service_areas: [
      { workspace_id: 'w', name: 'Cidade Base', match_terms: ['cidade base'], status: 'served', active: true },
      { workspace_id: 'w', name: 'Cidade Metro', match_terms: ['cidade metro'], status: 'served', active: true, price_tier: 'metro' },
    ],
    ai_approvals: [],
  };
  const from = (table) => {
    const filters = [];
    const q = {
      select() { return q; }, eq(c, v) { filters.push([c, v]); return q; }, in() { return q; }, order() { return q; }, limit() { return q; },
      insert(row) { inserts.push([table, row]); return Promise.resolve({ error: null }); },
      update() { return q; }, async maybeSingle() { return { data: null, error: null }; },
      then(resolve) { resolve({ data: (tables[table] || []).filter((r) => filters.every(([c, v]) => r[c] === v)), error: null }); },
    };
    return q;
  };
  const ctx = (local) => ({ supabase: { from }, workspaceId: 'w', conversation: { id: 'c1', lead_data: { data_evento: '2090-05-05', local } }, effects: {} });
  const semLocal = await executeTool('consultar_precos', {}, { ...ctx(''), conversation: { id: 'c1', lead_data: {} } });
  assert.equal(semLocal.erro, 'local_necessario');
  const b = ctx('Cidade Base'); await executeTool('consultar_precos', {}, b);
  assert.match(b.effects.quoteTableText, /✨ Duo – R\$ 1\.000/);
  assert.doesNotMatch(b.effects.quoteTableText, /locomoção/);
  const m = ctx('Cidade Metro'); // Cidade cadastrada (sem espaço não verificado).
  await executeTool('consultar_precos', {}, m);
  assert.match(m.effects.quoteTableText, /✨ Duo – R\$ 1\.400/);
  assert.match(m.effects.quoteTableText, /Para eventos fora de Cidade Base cobramos uma taxa de locomoção\.$/);
  tables.ai_service_areas.push({ workspace_id: 'w', name: 'Cidade Faixa Vazia', match_terms: ['cidade faixa vazia'], status: 'served', active: true, price_tier: 'ate120', travel_fee: 150 });
  const v = ctx('Cidade Faixa Vazia'); const rv = await executeTool('consultar_precos', {}, v);
  assert.equal(rv.erro, 'localidade_sem_parametrizacao', 'faixa sem preços: sem valores');
  assert.match(v.effects.regionPendingText, /Cidade Faixa Vazia, a equipe vai confirmar os valores/);
  const x = ctx('Município Não Cadastrado'); const r = await executeTool('consultar_precos', {}, x);
  assert.equal(r.erro, 'localidade_sem_parametrizacao');
  assert.equal(x.effects.quoteTableText, undefined, 'nenhum valor sai');
  assert.ok(inserts.some(([t, row]) => t === 'ai_approvals' && row.details?.region_parameterization), 'pendência para o Owner');
});

test('desconto no estilo da casa e memória das decisões aprovadas', async () => {
  const { detectObjections } = await import('../lib/ai/commercial/strategies.mjs');
  assert.ok(detectObjections('Teria como fazer algum valor a menos?').includes('discount'));
  const txt = formatStrategiesForPrompt(['price_objection'], { discountAsk: true, paymentApproved: false });
  assert.match(txt, /^- PEDIDO EXPLÍCITO DE DESCONTO/);
  assert.match(txt, /NÃO faça pergunta de triagem/);
  const block = formatClientMemory({
    lead_data: { nome: 'Cliente Teste', ultimo_orcamento: 'Trio — 2090-05-05: R$ 1.500' },
    team_decisions: [{ kind: 'discount', status: 'approved', summary: 'Desconto aprovado para Trio: total R$ 1.400' }, { kind: 'discount', status: 'rejected', summary: 'Pedido de R$ 1.000 recusado' }],
  });
  assert.match(block, /Último orçamento apresentado: Trio — 2090-05-05: R\$ 1\.500/);
  assert.match(block, /Decisão da equipe \(APROVADA, desconto\): Desconto aprovado/);
  assert.match(block, /Decisão da equipe \(RECUSADA, desconto\)/);
  assert.match(block, /NÃO estejam acima.*não confirme/);
  assert.ok(MEMORY_FIELDS_INCLUDES('ultimo_orcamento'));
});

test('assuntos pessoais: acolher sem compromisso; sem dados, sem tabela', () => {
  const p = buildSystemPrompt({ settings: { assistant_name: 'Nara' }, companyName: 'X' });
  assert.match(p, /agrupe-os em uma única mensagem/);
  assert.match(p, /sem roteiro fixo|não copie modelos literalmente/i);
  assert.match(p, /basta a cidade declarada pelo cliente/);
  assert.match(p, /Nunca invente/);
  assert.match(p, /Nunca diga nomes de ferramentas/);
});

test('primeiro contato sem dados: mensagem fixa com lista e link só se aprovado', async () => {
  const { isBareQuoteRequest, bareQuoteMessage } = await import('../lib/ai/agent/policy.mjs');
  assert.equal(isBareQuoteRequest('Olá, tudo bom? Gostaria de fazer um orçamento com vocês. Boa noite'), true);
  assert.equal(isBareQuoteRequest('Quanto fica um trio?'), false, 'com formação: segue o orçamento');
  assert.equal(isBareQuoteRequest('Orçamento para 12/12 em Cidade Base'), false, 'com data: segue a tabela');
  assert.equal(isBareQuoteRequest('Qual o valor?', { local: 'Cidade Base' }), false, 'local já informado');
  assert.equal(isBareQuoteRequest('Orçamento pra festa de aniversário'), false);
  const semLink = bareQuoteMessage(null);
  assert.match(semLink, /Noivos:\nData:\nLocal:\nHorário:$/);
  assert.doesNotMatch(semLink, /http/);
  assert.match(bareQuoteMessage('https://exemplo.test/monte-sua-banda/'), /https:\/\/exemplo\.test\/monte-sua-banda\/\n\nOu, se preferir, me envie por aqui:\nNoivos:/);
});

test('mensagens fixas preservam parágrafos e quebras de linha até o envio', async () => {
  const { bareQuoteMessage } = await import('../lib/ai/agent/policy.mjs');
  const { ensureFirstContactIntro } = await import('../lib/ai/agent/prompt.mjs');
  const { formatCeremonyTable } = await import('../lib/ai/agent/tools.mjs');
  const { sendTextMessage } = await import('../lib/ai/inbox/meta-client.mjs');
  const msg = ensureFirstContactIntro(bareQuoteMessage('https://exemplo.test/monte-sua-banda/'), { settings: { assistant_name: 'Nara', assistant_company: 'Banda Exemplo' }, joiner: '\n\n' });
  assert.equal(msg, 'Oi! Sou a Nara, assistente da Banda Exemplo ☺️\n\nQue bom que entrou em contato!\n\nPara agilizar seu orçamento, você pode montar sua formação (Duo, Trio, Quarteto...) por este link e me mandar tudo por aqui:\nhttps://exemplo.test/monte-sua-banda/\n\nOu, se preferir, me envie por aqui:\nNoivos:\nData:\nLocal:\nHorário:');
  const table = formatCeremonyTable([{ formacao: 'Duo', valor_cerimonia: 1000 }]);
  assert.match(table, /🎶 Orçamentos Cerimônia 🎶\n\n✨ Duo – R\$ 1\.000\nVoz\nPiano\n\nAs formações/);
  let sent;
  await sendTextMessage({ phoneNumberId: 'p', token: 't', to: '5500', text: msg, fetchImpl: async (_u, init) => { sent = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'w1' }] }) }; } });
  assert.equal(sent.text.body, msg, 'corpo enviado à Meta idêntico, com \\n preservados');
});

test('localidade sem parametrização: resposta fixa, sem valores e sem perguntas', async () => {
  const { regionPendingMessage } = await import('../lib/ai/agent/tools.mjs');
  const m = regionPendingMessage('Município Exemplo');
  assert.equal(m, 'Para o seu evento em Município Exemplo, a equipe vai confirmar os valores certinho e já te retorna por aqui, tá bom? ☺️');
  assert.doesNotMatch(m.replace(/tá bom\?/, ''), /\?/, 'nenhuma pergunta de dados');
  assert.doesNotMatch(m, /R\$/);
});

