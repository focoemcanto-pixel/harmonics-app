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
export function sanitizeStaticText(input) {
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
  if (text.length > MAX_LEN) {
    const cut = text.slice(0, MAX_LEN);
    text = `${cut.slice(0, Math.max(cut.lastIndexOf('. '), MAX_LEN * 0.6) + 1).trim()}`;
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
    supabase.from('event_types').select('id, name, description, is_active').eq('workspace_id', workspaceId),
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
  const add = async ({ key, kind, title, content, intents = [], origin, priority = 50, removed = [] }) => {
    const ref = await sha256Hex(`${origin.table}:${origin.id}:${origin.field}:${key}`);
    candidates.push({ item_key: `import-${origin.table.replace(/_/g, '-')}-${key}-${ref.slice(0, 8)}`, kind, title, content, intents, priority,
      metadata: { origin: { ...origin, imported_by: 'bootstrap' }, removed_dynamic: removed } });
  };

  if (sources.eventTypes?.length) {
    const list = sources.eventTypes.map((t) => (t.description ? `${t.name} (${sanitizeStaticText(t.description).text || ''})`.replace(' ()', '') : t.name));
    await add({ key: 'types', kind: 'faq', title: 'Tipos de evento atendidos', intents: ['formation'],
      content: `Tipos de evento cadastrados: ${list.join('; ')}. Para valores e formação, use as ferramentas oficiais.`,
      origin: { table: 'event_types', id: 'workspace', field: 'name,description' } });
  }

  const preferred = [...(sources.contracts || [])].sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)));
  const seenTopics = new Set();
  for (const tpl of preferred) {
    const body = tpl.source_rich_html || tpl.content || tpl.source_text || '';
    for (const { topic, text } of extractContractClauses(body)) {
      if (seenTopics.has(topic.key)) continue; // modelo padrão primeiro; evita duplicar entre modelos
      const clean = sanitizeStaticText(text);
      if (!clean.text) continue;
      seenTopics.add(topic.key);
      await add({ key: topic.key, kind: topic.kind, title: topic.title, intents: topic.intents, removed: clean.removed,
        content: `Conforme o modelo de contrato "${tpl.name}": ${clean.text}`,
        origin: { table: 'contract_templates', id: tpl.id, field: 'content' } });
    }
  }

  for (const msg of sources.messages || []) {
    if (!CLIENT_MESSAGE.test(`${msg.key} ${msg.recipient_type}`)) continue;
    const clean = sanitizeStaticText(msg.body);
    if (!clean.text) continue;
    const post = /repert|payment|pagamento|review|contract|event_day/i.test(msg.key);
    await add({ key: String(msg.key || msg.id).replace(/[^a-z0-9]+/gi, '-').slice(0, 40), kind: post ? 'post_sale' : 'style',
      title: `Mensagem oficial: ${msg.name || msg.key}`, intents: post ? ['repertoire', 'payment'] : [], removed: clean.removed,
      content: `Texto aprovado usado nas automações (referência de tom e informação; não copiar literalmente): ${clean.text}`,
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
    supabase.from('ai_knowledge_items').select('item_key, content').eq('workspace_id', workspaceId),
    supabase.from('ai_service_areas').select('name, match_terms').eq('workspace_id', workspaceId),
  ]);
  const keys = new Set((existing || []).map((e) => e.item_key));
  const contents = new Set((existing || []).map((e) => contentKey(e.content)));
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
    created.push({ id: c.id || null, item_key: c.item_key, kind: c.kind, title: c.title, content: c.content, origin: c.metadata.origin, removed_dynamic: c.metadata.removed_dynamic });
  }
  return {
    dryRun, created, skipped,
    areaSuggestions: areaSuggestions.filter((a) => !known.has(a.name.toLowerCase()) && !known.has(a.name.split(' - ')[0].toLowerCase())),
  };
}
