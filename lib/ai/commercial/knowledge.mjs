/**
 * Recuperação contextual SELETIVA de conhecimento aprovado (sem embeddings, sem enviar
 * históricos completos): pontuação lexical (BM25 simplificado) + intenção + prioridade,
 * com orçamento de caracteres. Regras de alta prioridade (>= 90) entram sempre.
 */
const STOP = new Set('a o e de da do das dos em no na nos nas um uma uns umas para por com sem que se ou ao aos as os é eu voce você vocês voces me te lhe meu minha seu sua isso esse essa este esta qual quais como quando onde tem ter vai ser mais muito pra pro oi ola olá bom boa dia tarde noite tudo bem obrigado obrigada'.split(' '));

export function tokenize(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => (t.length > 5 ? t.replace(/(oes|aes|ais|eis|ns|s)$/, '') : t));
}

/** Intenções por palavras-chave (determinístico e barato). */
const INTENT_PATTERNS = {
  pricing: /\b(valor|preco|preço|quanto|orcamento|orçamento|custa|investimento|caro|barato)\b/,
  availability: /\b(data|disponib|agenda|livre|dia \d|marcar)\b/,
  repertoire: /\b(repertorio|repertório|musica|música|cortejo|entrada|playlist|youtube|trecho)\b/,
  payment: /\b(pagamento|pagar|pix|boleto|cartao|cartão|comprovante|parcela|sinal)\b/,
  meeting: /\b(reuniao|reunião|call|videochamada|conversar pessoalmente|encontro)\b/,
  rider: /\b(som|sonorizacao|sonorização|microfone|energia|tomada|equipamento|palco|cobertura|tenda)\b/,
  location: /\b(cidade|local|igreja|espaco|espaço|endereco|endereço|fica|distancia|distância|viagem)\b/,
  formation: /\b(solo|duo|trio|quarteto|quinteto|sexteto|septeto|formacao|formação|violino|violoncelo|piano|teclado|voz|cantor)\b/,
  contract: /\b(contrato|assinatura|assinar|clausula|cláusula|pre.?contrato)\b/,
};

export function detectIntents(text) {
  const t = String(text || '').toLowerCase();
  return Object.entries(INTENT_PATTERNS).filter(([, re]) => re.test(t)).map(([k]) => k);
}

export function scoreItem(item, queryTokens, intents) {
  const docTokens = tokenize(`${item.title} ${item.content} ${(item.keywords || []).join(' ')}`);
  if (!docTokens.length) return 0;
  const freq = new Map();
  for (const t of docTokens) freq.set(t, (freq.get(t) || 0) + 1);
  let score = 0;
  for (const q of new Set(queryTokens)) {
    const f = freq.get(q) || 0;
    if (f) score += (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (docTokens.length / 60)));
  }
  const intentHits = (item.intents || []).filter((i) => intents.includes(i)).length;
  score += intentHits * 2;
  score += (Number(item.priority) || 50) / 100;
  return score;
}

/**
 * Seleciona conhecimento ativo relevante. Conflitos (mesma intenção e tipo regra/política)
 * resolvem-se pela maior prioridade: a de menor prioridade é suprimida.
 */
export function selectKnowledge(items = [], { text = '', intents = null, limit = 5, charBudget = 1800, kinds = null } = {}) {
  const active = items.filter((i) => i.status === 'active' && (!kinds || kinds.includes(i.kind)));
  const qTokens = tokenize(text);
  const qIntents = intents || detectIntents(text);
  const always = active.filter((i) => Number(i.priority) >= 90 && ['rule', 'policy'].includes(i.kind));
  const ranked = active
    .filter((i) => !always.includes(i))
    .map((i) => ({ item: i, score: scoreItem(i, qTokens, qIntents) }))
    .filter((r) => r.score > 1.2)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);

  // Maior prioridade por (tipo, intenção) entre regras/políticas candidatas.
  const topPriority = new Map();
  for (const item of [...always, ...ranked]) {
    if (!['rule', 'policy'].includes(item.kind)) continue;
    for (const i of item.intents || []) {
      const k = `${item.kind}:${i}`;
      topPriority.set(k, Math.max(Number(item.priority) || 0, topPriority.get(k) || 0));
    }
  }
  const chosen = [];
  let used = 0;
  for (const item of [...always.sort((a, b) => b.priority - a.priority), ...ranked]) {
    if (chosen.length >= limit + always.length) break;
    if (['rule', 'policy'].includes(item.kind)
      && (item.intents || []).some((i) => (topPriority.get(`${item.kind}:${i}`) || 0) > (Number(item.priority) || 0))) continue;
    const size = item.title.length + item.content.length + 8;
    if (used + size > charBudget && chosen.length) continue;
    chosen.push(item);
    used += size;
  }
  return chosen;
}

/** Conflitos para revisão no painel: mesma intenção + tipo, ativos, conteúdos diferentes. */
export function detectConflicts(items = [], candidate) {
  if (!candidate || !['rule', 'policy', 'rider'].includes(candidate.kind)) return [];
  return items.filter((i) => i.status === 'active'
    && i.item_key !== candidate.item_key
    && i.kind === candidate.kind
    && (i.intents || []).some((x) => (candidate.intents || []).includes(x))
    && (candidate.kind !== 'rider' || JSON.stringify(i.metadata?.formation) === JSON.stringify(candidate.metadata?.formation)))
    .map((i) => ({ id: i.id, item_key: i.item_key, title: i.title, priority: i.priority }));
}

/** Tipos que nunca entram em vigor sem aprovação explícita. */
export const APPROVAL_REQUIRED_KINDS = Object.freeze(['rule', 'policy', 'rider', 'faq', 'response', 'post_sale', 'example', 'style']);

export function formatKnowledgeForPrompt(items = []) {
  if (!items.length) return '';
  return items.map((i) => {
    const scope = i.metadata?.scope?.event_types?.length ? ` (somente ${i.metadata.scope.event_types.join(', ')})` : '';
    return `- [${i.kind}${scope}] ${i.title}: ${i.content.replace(/\s+/g, ' ').trim()}`;
  }).join('\n');
}

export function slugKey(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `item-${Date.now()}`;
}
