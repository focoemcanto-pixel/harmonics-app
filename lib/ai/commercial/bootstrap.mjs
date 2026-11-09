/**
 * Inicialização inteligente da base de conhecimento a partir do que o Harmonics já tem.
 *  - Cria SUGESTÕES versionadas (status pending_approval, source 'import'), nunca ativas.
 *  - Origem identificada em metadata.origin { table, id, field } e item_key determinístico.
 *  - Não copia valores dinâmicos: preços (R$), percentuais de valor, datas e variáveis de
 *    template são removidos; preço e disponibilidade continuam vindo das ferramentas oficiais.
 *  - Idempotente: ignora item_key já existente (qualquer status/versão) e conteúdo repetido.
 *  - Localidades do histórico viram sugestões para o admin cadastrar (não cria áreas).
 */
import { sha256Hex } from '../inbox/meta-webhook.mjs';
import { tokenize } from './knowledge.mjs';

const MAX_LEN = 700;

/** Remove valores dinâmicos e variáveis; retorna null se sobrar texto inútil. */
export function sanitizeStaticText(input, { maxLen = MAX_LEN } = {}) {
  let text = String(input || '');
  const removed = [];
  const rep = (re, label, by) => { if (re.test(text)) { removed.push(label); text = text.replace(re, by); } re.lastIndex = 0; };
  rep(/\{\{\s*[^}]+\s*\}\}|\{[a-z_]+\}|\[\[[^\]]+\]\]/gi, 'template_variable', '(dado do contrato)');
  rep(/R\$\s*[\d.]+(,\d{2})?/gi, 'currency', '(valor oficial)');
  rep(/\b\d+(,\d+)?\s*(reais|mil reais)\b/gi, 'currency', '(valor oficial)');
  rep(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g, 'date', '(data do evento)');
  rep(/\b(\d{2,3}[.\-\s]?)?\d{4,5}[-\s]?\d{4}\b/g, 'phone', '');
  rep(/[\w.+-]+@[\w-]+\.[\w.]+/g, 'email', '');
  text = text.replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim();
  if (text.length > maxLen) {
    // Corta no fim de uma frase, nunca logo após o marcador de um item numerado ("4. ").
    const cut = text.slice(0, maxLen);
    let stop = -1;
    for (const m of cut.matchAll(/[.!?](?=\s)/g)) if (!/(^|\s)\d{1,2}$/.test(cut.slice(Math.max(0, m.index - 3), m.index))) stop = m.index;
    text = cut.slice(0, Math.max(stop, Math.floor(maxLen * 0.6)) + 1).trim();
  }
  return { text: tokenize(text).length >= 4 ? text : null, removed: [...new Set(removed)] };
}

function htmlToParagraphs(html) {
  return String(html || '')
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 40);
}

/** Tópicos de política/rider reconhecidos em cláusulas de contrato. */
export const CLAUSE_TOPICS = [
  { key: 'payment', kind: 'policy', title: 'Condições de pagamento', intents: ['payment'], re: /\b(pagamento|sinal|parcela|saldo|pix|boleto|cart[aã]o)\b/i },
  { key: 'cancellation', kind: 'policy', title: 'Cancelamento e remarcação', intents: ['contract'], re: /\b(rescis|cancelament|desist|remarca|reagend|multa)\w*/i },
  { key: 'punctuality', kind: 'policy', title: 'Horário, duração e atrasos', intents: ['availability'], re: /\b(atraso|toler[aâ]ncia|hora extra|horas extras|dura[cç][aã]o|pontualidade)\b/i },
  { key: 'structure', kind: 'rider', title: 'Estrutura e responsabilidades técnicas', intents: ['rider'], re: /\b(energia|tomada|el[eé]tric|cobertura|tenda|palco|camarim|som|sonoriza|microfone|equipamento)\w*/i },
  { key: 'meals', kind: 'policy', title: 'Alimentação e apoio à equipe', intents: ['rider'], re: /\b(alimenta[cç][aã]o|refei[cç][aã]o|lanche|[aá]gua)\b/i },
  { key: 'repertoire', kind: 'post_sale', title: 'Repertório', intents: ['repertoire'], re: /\b(repert[oó]rio|m[uú]sicas?|cortejo)\b/i },
];

// Ordem de prioridade: tópicos mais específicos primeiro; cada parágrafo vai para um só tópico.
const TOPIC_PRIORITY = ['cancellation', 'punctuality', 'structure', 'meals', 'repertoire', 'payment'];

export function extractContractClauses(html) {
  const byTopic = new Map();
  const ordered = TOPIC_PRIORITY.map((k) => CLAUSE_TOPICS.find((t) => t.key === k));
  for (const paragraph of htmlToParagraphs(html)) {
    const topic = ordered.find((t) => t.re.test(paragraph));
    if (!topic) continue;
    const list = byTopic.get(topic.key) || [];
    if (list.length < 3) list.push(paragraph);
    byTopic.set(topic.key, list);
  }
  return CLAUSE_TOPICS.filter((t) => byTopic.has(t.key)).map((topic) => ({ topic, text: byTopic.get(topic.key).join(' ') }));
}

/** Cidade a partir de endereço livre ("..., Cidade - UF" ou "..., Cidade, UF"). */
export function cityFromAddress(address) {
  const s = String(address || '');
  const m = /([A-Za-zÀ-ú' ]{3,40})\s*[-,/]\s*([A-Z]{2})\b(?!.*\b[A-Z]{2}\b)/.exec(s);
  if (!m) return null;
  const city = m[1].trim().replace(/\s+/g, ' ');
  return /^(rua|av|avenida|bairro|centro)$/i.test(city) ? null : `${city} - ${m[2]}`;
}


// ---------------------------------------------------------------------------
// Contradições numéricas ("50% (trinta por cento)") e escopo por modelo/tipo de evento
// ---------------------------------------------------------------------------
const UNITS = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
const TENS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const HUNDREDS = { cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900 };

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "vinte e cinco" → 25; "trinta por cento" → 30; "mil e quinhentos" → 1500. null se não for número por extenso. */
export function parsePtNumber(text) {
  const words = norm(text).replace(/por cento|porcento|reais|real|centavos?|dias?|horas?|minutos?|meses|mes|anos?/g, ' ')
    .split(/[\s-]+/).filter((w) => w && w !== 'e');
  if (!words.length) return null;
  let total = 0;
  let chunk = 0;
  for (const w of words) {
    if (w in UNITS) chunk += UNITS[w];
    else if (w in TENS) chunk += TENS[w];
    else if (w in HUNDREDS) chunk += HUNDREDS[w];
    else if (w === 'mil') { total += (chunk || 1) * 1000; chunk = 0; }
    else return null;
  }
  return total + chunk;
}

/** Números escritos em algarismo e por extenso que não batem. */
export function detectNumberWordMismatches(text) {
  const out = [];
  const re = /(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(%|dias?|horas?|meses|reais)?\s*\(\s*([a-zà-ú\s-]+?)\s*\)/gi;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const digits = Number(m[1].replace(/\./g, '').replace(',', '.'));
    const parsed = parsePtNumber(m[3]);
    if (parsed !== null && Number.isFinite(digits) && parsed !== digits) out.push({ excerpt: m[0].trim().slice(0, 80), digits, words: m[3].trim(), parsed });
  }
  return out;
}

/** Escopo de um modelo de contrato: tipo(s) de evento ligados ou nome; sem vínculo = não classificado. */
export function templateScope(tpl, eventTypes = []) {
  const linked = eventTypes.filter((t) => t.default_contract_template_id && t.default_contract_template_id === tpl.id);
  let classifiedBy = linked.length ? 'default_contract_template' : null;
  let types = linked;
  if (!types.length) {
    const name = ` ${norm(tpl.name)} `;
    types = eventTypes.filter((t) => t.name && name.includes(` ${norm(t.name)} `.trim()) && norm(t.name).length >= 4);
    if (types.length) classifiedBy = 'template_name';
  }
  return {
    event_types: types.map((t) => t.name),
    event_type_ids: types.map((t) => t.id),
    contract_template_id: tpl.id,
    contract_template_name: tpl.name,
    service: 'contrato',
    classified_by: classifiedBy,
  };
}

/** O item vale para a conversa? Sem escopo = geral; com escopo, só se o tipo de evento casar. */
export function matchesScope(item, conversationEventType) {
  const types = item?.metadata?.scope?.event_types || [];
  if (!types.length) return true;
  const conv = norm(conversationEventType).trim();
  if (!conv) return false;
  return types.some((t) => { const n = norm(t).trim(); return n && (conv.includes(n) || n.includes(conv)); });
}

const SPECIFIC_TERMS = /(\d+\s*%|\bparcela|\bsinal\b|\bsaldo\b|\b\d+\s*(dias?|horas?|meses)\b|\bvencimento)/i;

const PRODUCT_FAQ = [
  {
    key: 'client-panel', kind: 'post_sale', title: 'Painel do cliente (após a contratação)', intents: ['repertoire', 'payment'],
    content: 'Depois do contrato assinado o cliente recebe um link individual do painel. Lá ele monta o repertório por momento (entrada, cortejo, saída e demais momentos), vê sugestões por momento, busca músicas pelo YouTube, anota trechos e observações, acompanha pagamentos e envia comprovantes. Envie somente o link individual do próprio cliente (obter_link_cliente). Se precisar de ajuda para montar o repertório, ofereça uma reunião com a equipe.',
    origin: { table: 'harmonics_product', id: 'app/cliente', field: 'funcionalidades' },
  },
  {
    key: 'pricing-source', kind: 'rule', title: 'Valores e disponibilidade', intents: ['pricing', 'availability'], priority: 90,
    content: 'Valores, formações disponíveis, taxas de deslocamento e agenda mudam e vêm sempre das ferramentas oficiais (calcular_orcamento, listar_formacoes, consultar_disponibilidade). Nunca use valores escritos em textos de conhecimento.',
    origin: { table: 'harmonics_product', id: 'pricing', field: 'fonte_oficial' },
  },
];

export async function loadBootstrapSources({ supabase, workspaceId }) {
  const [eventTypes, contracts, messages, moments, genres, events] = await Promise.all([
    supabase.from('event_types').select('id, name, description, is_active, default_contract_template_id').eq('workspace_id', workspaceId),
    supabase.from('contract_templates').select('id, name, content, source_text, source_rich_html, is_active, is_default').eq('workspace_id', workspaceId),
    supabase.from('message_templates').select('id, key, name, body, recipient_type, is_active').eq('workspace_id', workspaceId),
    supabase.from('suggestion_moments').select('id, name, is_active, sort_order'),
    supabase.from('suggestion_genres').select('id, name, is_active, sort_order'),
    supabase.from('events').select('location_address').eq('workspace_id', workspaceId).limit(2000),
  ]);
  return {
    eventTypes: (eventTypes.data || []).filter((r) => r.is_active !== false),
    contracts: (contracts.data || []).filter((r) => r.is_active !== false),
    messages: (messages.data || []).filter((r) => r.is_active !== false),
    moments: (moments.data || []).filter((r) => r.is_active !== false),
    genres: (genres.data || []).filter((r) => r.is_active !== false),
    addresses: (events.data || []).map((e) => e.location_address).filter(Boolean),
  };
}

const CLIENT_MESSAGE = /client|cliente/i;

/** Puro: monta candidatos a partir das fontes. */
export async function buildBootstrapCandidates(sources) {
  const candidates = [];
  const add = async ({ key, kind, title, content, intents = [], origin, priority = 50, removed = [], scope = null, review = null }) => {
    const ref = await sha256Hex(`${origin.table}:${origin.id}:${origin.field}:${key}`);
    candidates.push({ item_key: `import-${origin.table.replace(/_/g, '-')}-${key}-${ref.slice(0, 8)}`, kind, title, content, intents, priority,
      metadata: {
        origin: { ...origin, imported_by: 'bootstrap', bootstrap_version: 2 }, removed_dynamic: removed,
        ...(scope ? { scope } : {}),
        review: review && review.flags.length ? { flags: review.flags, reasons: review.reasons, required: true } : { flags: [], reasons: [], required: false },
      } });
  };

  if (sources.eventTypes?.length) {
    const list = sources.eventTypes.map((t) => (t.description ? `${t.name} (${sanitizeStaticText(t.description).text || ''})`.replace(' ()', '') : t.name));
    await add({ key: 'types', kind: 'faq', title: 'Tipos de evento atendidos', intents: ['formation'],
      content: `Tipos de evento cadastrados: ${list.join('; ')}. Para valores e formação, use as ferramentas oficiais.`,
      origin: { table: 'event_types', id: 'workspace', field: 'name,description' } });
  }

  // Contratos: uma sugestão por (modelo, tópico), sempre com escopo do modelo/tipo de evento.
  const byTopicScope = new Map();
  for (const tpl of sources.contracts || []) {
    const body = tpl.source_rich_html || tpl.content || tpl.source_text || '';
    const scope = templateScope(tpl, sources.eventTypes || []);
    for (const { topic, text } of extractContractClauses(body)) {
      const mismatches = detectNumberWordMismatches(text);
      const clean = sanitizeStaticText(text);
      if (!clean.text) continue;
      const flags = [];
      const reasons = [];
      if (mismatches.length) { flags.push('number_word_mismatch'); reasons.push(...mismatches.map((x) => `"${x.excerpt}": ${x.digits} ≠ ${x.parsed}`)); }
      if (!scope.classified_by) { flags.push('unclassified_scope'); reasons.push('Modelo sem tipo de evento vinculado: não usar como regra geral.'); }
      if (topic.key === 'payment' || SPECIFIC_TERMS.test(clean.text)) { flags.push('contract_specific_terms'); reasons.push('Condição específica deste modelo (percentuais/prazos), não política geral.'); }
      const scopeLabel = scope.event_types.length ? scope.event_types.join(', ') : 'não classificado';
      const key = `${topic.key}-${String(tpl.id).slice(0, 8)}`;
      const groupKey = `${topic.key}|${scope.event_types.slice().sort().join(',') || tpl.id}`;
      const group = byTopicScope.get(groupKey) || [];
      group.push({ key, text: clean.text });
      byTopicScope.set(groupKey, group);
      await add({
        key, kind: topic.kind, title: `${topic.title} — ${scopeLabel}`, intents: topic.intents, removed: clean.removed,
        content: `Somente para ${scope.event_types.length ? `eventos do tipo ${scopeLabel}` : 'o modelo indicado'} (modelo de contrato "${tpl.name}"): ${clean.text}`,
        origin: { table: 'contract_templates', id: tpl.id, field: 'content' },
        scope, review: { flags, reasons },
      });
    }
  }
  // Mesmo tópico e mesmo escopo com textos diferentes em modelos distintos => revisar.
  for (const group of byTopicScope.values()) {
    if (group.length < 2 || new Set(group.map((g) => g.text)).size < 2) continue;
    for (const g of group) {
      const c = candidates.find((x) => x.item_key.includes(`-${g.key}-`));
      if (c && !c.metadata.review.flags.includes('divergent_templates')) {
        c.metadata.review.flags.push('divergent_templates');
        c.metadata.review.reasons.push('Outro modelo do mesmo tipo de evento diz algo diferente sobre este tema.');
        c.metadata.review.required = true;
      }
    }
  }

  // Mensagens oficiais: só referência de tom e fluxo (nunca regra contratual).
  for (const msg of sources.messages || []) {
    if (!CLIENT_MESSAGE.test(`${msg.key} ${msg.recipient_type}`)) continue;
    const clean = sanitizeStaticText(msg.body);
    if (!clean.text) continue;
    await add({ key: String(msg.key || msg.id).replace(/[^a-z0-9]+/gi, '-').slice(0, 40), kind: 'style',
      title: `Tom e fluxo: ${msg.name || msg.key}`, intents: [], removed: clean.removed,
      content: `Referência de tom e fluxo de comunicação (não é regra nem condição contratual; não copiar literalmente): ${clean.text}`,
      origin: { table: 'message_templates', id: msg.id, field: 'body' } });
  }

  if (sources.moments?.length) {
    const moments = [...sources.moments].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((m) => m.name);
    const genres = (sources.genres || []).map((g) => g.name);
    await add({ key: 'catalog', kind: 'post_sale', title: 'Momentos e estilos do repertório', intents: ['repertoire'],
      content: `No painel, o repertório é organizado pelos momentos: ${moments.join(', ')}.${genres.length ? ` Estilos disponíveis para sugestões: ${genres.join(', ')}.` : ''}`,
      origin: { table: 'suggestion_moments', id: 'catalog', field: 'name' } });
  }

  for (const p of PRODUCT_FAQ) await add(p);

  const counts = new Map();
  for (const a of sources.addresses || []) {
    const city = cityFromAddress(a);
    if (city) counts.set(city, (counts.get(city) || 0) + 1);
  }
  const areaSuggestions = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([name, events]) => ({ name, events }));
  return { candidates, areaSuggestions };
}

function contentKey(text) {
  return tokenize(text).slice(0, 40).join(' ');
}

/** Executa (ou simula com dryRun) a criação das sugestões pendentes. */
export async function bootstrapKnowledge({ supabase, workspaceId, actor = null, dryRun = true }) {
  const sources = await loadBootstrapSources({ supabase, workspaceId });
  const { candidates, areaSuggestions } = await buildBootstrapCandidates(sources);
  const [{ data: existing }, { data: areas }] = await Promise.all([
    supabase.from('ai_knowledge_items').select('id, item_key, content, status, source, metadata').eq('workspace_id', workspaceId),
    supabase.from('ai_service_areas').select('name, match_terms').eq('workspace_id', workspaceId),
  ]);
  // Sugestões da 1ª versão do bootstrap sem escopo (cláusulas gerais / mensagens como regra):
  // se ainda PENDENTES, são substituídas; aprovadas/ativas nunca são tocadas.
  const legacy = (existing || []).filter((e) => e.source === 'import' && e.status === 'pending_approval'
    && !e.metadata?.origin?.bootstrap_version
    && (e.metadata?.origin?.table === 'contract_templates' || e.metadata?.origin?.table === 'message_templates'));
  const legacyIds = new Set(legacy.map((e) => e.id));
  const current = (existing || []).filter((e) => !legacyIds.has(e.id));
  const keys = new Set(current.map((e) => e.item_key));
  const contents = new Set(current.map((e) => contentKey(e.content)));
  const known = new Set((areas || []).flatMap((a) => [a.name, ...(a.match_terms || [])]).map((x) => String(x).toLowerCase()));

  const created = [];
  const skipped = [];
  for (const c of candidates) {
    if (keys.has(c.item_key)) { skipped.push({ item_key: c.item_key, title: c.title, reason: 'already_imported' }); continue; }
    if (contents.has(contentKey(c.content))) { skipped.push({ item_key: c.item_key, title: c.title, reason: 'duplicate_content' }); continue; }
    if (!dryRun) {
      const { data, error } = await supabase.rpc('ai_knowledge_propose', {
        p_workspace_id: workspaceId, p_item_key: c.item_key, p_kind: c.kind, p_title: c.title, p_content: c.content,
        p_intents: c.intents, p_keywords: [], p_metadata: c.metadata, p_priority: c.priority, p_source: 'import', p_actor: actor,
      });
      if (error) { skipped.push({ item_key: c.item_key, title: c.title, reason: 'error' }); continue; }
      const row = Array.isArray(data) ? data[0] : data;
      c.id = row?.id;
    }
    keys.add(c.item_key);
    contents.add(contentKey(c.content));
    created.push({
      id: c.id || null, item_key: c.item_key, kind: c.kind, title: c.title, content: c.content, origin: c.metadata.origin,
      removed_dynamic: c.metadata.removed_dynamic, scope: c.metadata.scope || null, review: c.metadata.review,
    });
  }
  if (!dryRun && legacy.length) {
    for (const e of legacy) {
      await supabase.from('ai_knowledge_items').update({ status: 'rejected', metadata: { ...(e.metadata || {}), superseded_by: 'bootstrap_v2' } })
        .eq('id', e.id).eq('workspace_id', workspaceId).eq('status', 'pending_approval');
    }
  }
  const replaced = legacy.map((e) => ({ id: e.id, item_key: e.item_key }));
  return {
    dryRun, created, skipped, replaced,
    needsReview: created.filter((c) => c.review?.required).length,
    areaSuggestions: areaSuggestions.filter((a) => !known.has(a.name.toLowerCase()) && !known.has(a.name.split(' - ')[0].toLowerCase())),
  };
}
