/**
 * Importação do Manual Mestre (Markdown) enviado pelo Owner no painel.
 *  - Seções → sugestões de conhecimento PENDENTES (source 'import', origem §), sem valores em R$
 *    (preço continua vindo das tabelas oficiais). "PENDENTE" no texto ⇒ revisão obrigatória.
 *  - Tabelas de preço/cachês → propostas em ai_pricing_proposals (pendentes). Só entram em
 *    quote_price_rules quando o Owner aprova; vigência ambígua exige data informada na aprovação.
 *  - Cachês, resultados e margens NUNCA viram conhecimento (segredo comercial, §9).
 * O conteúdo do manual não é versionado no repositório: fica no banco do workspace.
 */
import { sanitizeStaticText } from './bootstrap.mjs';
import { sha256Hex } from '../inbox/meta-webhook.mjs';

const FORMATION_ALIASES = { solo: 'solo', duo: 'duo', dupla: 'duo', trio: 'trio', quarteto: 'quarteto', quinteto: 'quinteto', sexteto: 'sexteto', septeto: 'septeto' };
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function parseMoney(text) {
  const m = /R\$\s*([\d.]+(?:,\d{1,2})?)/.exec(String(text || ''));
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Divide em seções "## N. Título" e subseções "### N.M ...". */
export function splitSections(markdown) {
  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  const sections = [];
  let current = null;
  let sub = null;
  for (const line of lines) {
    const h2 = /^##\s+(\d+)\.\s+(.+)$/.exec(line);
    const h3 = /^###\s+(\d+(?:\.\d+)?)?\s*(.+)$/.exec(line);
    if (h2) { current = { number: h2[1], title: h2[2].trim(), lines: [], subs: [] }; sections.push(current); sub = null; continue; }
    if (/^##\s/.test(line)) { current = null; sub = null; continue; } // "## Sumário", "## Princípio final"
    if (h3 && current) { sub = { number: h3[1] || '', title: h3[2].trim(), lines: [] }; current.subs.push(sub); continue; }
    if (current) (sub || current).lines.push(line);
  }
  return sections;
}

/** Tabela Markdown → { header: [...], rows: [[...]] }. */
export function parseTables(lines) {
  const tables = [];
  let block = [];
  const flush = () => {
    if (block.length >= 3 && /^\|?\s*:?-{2,}/.test(block[1].replace(/\|/g, '').trim() ? block[1].trim().replace(/^\|/, '') : '')) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      tables.push({ header: cells(block[0]), rows: block.slice(2).map(cells) });
    }
    block = [];
  };
  for (const line of lines) {
    if (/^\s*\|/.test(line)) block.push(line);
    else if (block.length) flush();
  }
  if (block.length) flush();
  return tables;
}

const TIER_RULES = [
  { re: /metropolitan/, tier: 'metro' },
  { re: /120\s*km/, tier: 'ate120' },
  { re: /salvador|regiao-base|regiao base|lauro/, tier: null },
];

function tierFor(title) {
  const t = norm(title);
  const found = TIER_RULES.find((r) => r.re.test(t));
  return found ? found.tier : null;
}

function validityFor(title, body) {
  const t = norm(`${title} ${body}`);
  const until = /ate (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de (\d{4})/.exec(t);
  const months = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  if (until) {
    const m = months.indexOf(until[1]) + 1;
    const last = new Date(Date.UTC(Number(until[2]), m, 0)).toISOString().slice(0, 10);
    return { valid_from: null, valid_until: last, pending: false };
  }
  return { valid_from: null, valid_until: null, pending: /pendente|nova tabela|confirmar (a )?(data|vigencia)/.test(t) };
}

/** Propostas de preço a partir das tabelas do manual (pendentes). */
export function extractPricingProposals(sections) {
  const out = [];
  const push = (p) => out.push({ ...p, amount: Number(p.amount) });
  for (const sec of sections) {
    const title = norm(sec.title);
    const blocks = [{ number: sec.number, title: sec.title, lines: sec.lines, parent: sec }, ...sec.subs.map((sub) => ({ ...sub, parent: sec }))];
    for (const b of blocks) {
      const body = b.lines.join('\n');
      const tables = parseTables(b.lines);
      if (/tabelas? de cerimonia/.test(title)) {
        const tier = tierFor(b.title);
        const v = validityFor(b.title, body);
        for (const t of tables) for (const row of t.rows) {
          const f = FORMATION_ALIASES[norm(row[0])];
          const amount = parseMoney(row[1]);
          if (f && amount !== null) push({ category: 'ceremony', item_key: tier ? `${f}@${tier}` : f, label: `Cerimônia ${row[0]}${tier ? ` (${b.title})` : ''}`, amount, valid_until: v.valid_until, valid_from: v.valid_from, metadata: { section: `§${b.number || sec.number}`, tier, pending_validity: v.pending || Boolean(tier) } });
        }
      } else if (/receptivo vinculado/.test(title) || /avulsas|por tempo/.test(title)) {
        const isReception = /receptivo vinculado/.test(title);
        const category = isReception ? 'reception' : 'other';
        for (const t of tables) {
          const hourCols = t.header.map((h, i) => [i, /(\d)\s*hora/.exec(norm(h))?.[1]]).filter(([, h]) => h);
          for (const row of t.rows) {
            const f = FORMATION_ALIASES[norm(row[0])];
            if (!f) continue;
            for (const [i, h] of hourCols) {
              const amount = parseMoney(row[i]);
              if (amount !== null) push({ category, item_key: isReception ? `${f}_${h}h` : `show:${f}_${h}h`, label: `${isReception ? 'Receptivo adicional' : 'Apresentação por tempo'} ${row[0]} ${h}h`, amount, metadata: { section: `§${sec.number}` } });
            }
          }
        }
      } else if (/cache|resultado e margem/.test(title)) {
        for (const t of tables) for (const row of t.rows) {
          const who = norm(row[0]);
          const key = /teclad/.test(who) ? 'keyboard' : /music/.test(who) ? 'musician' : null;
          if (!key) continue;
          const local = parseMoney(row[1]);
          const outside = parseMoney(row[2]);
          if (local !== null) push({ category: 'musician_fee', item_key: `${key}_local`, label: `Cachê ${row[0]} — região-base`, amount: local, metadata: { section: `§${b.number || sec.number}`, internal: true } });
          if (outside !== null) push({ category: 'musician_fee', item_key: `${key}_outside`, label: `Cachê ${row[0]} — fora da região-base`, amount: outside, metadata: { section: `§${b.number || sec.number}`, internal: true } });
        }
        const extra = /R\$\s*[\d.,]+\s*por hora de receptivo/i.exec(body);
        if (extra) push({ category: 'musician_fee', item_key: 'reception_extra_hour', label: 'Extra por hora de receptivo (músico contratado)', amount: parseMoney(extra[0]), metadata: { section: `§${b.number || sec.number}`, internal: true } });
      } else if (/sonorizacao/.test(title)) {
        const m = /(R\$\s*[\d.,]+)[^.]*?separada da m[uú]sica|refer[eê]ncia comercial de sonoriza[cç][aã]o [eé] \*{0,2}(R\$\s*[\d.,]+)/i.exec(body);
        const amount = m ? parseMoney(m[0]) : null;
        if (amount !== null) push({ category: 'sound', item_key: 'church', label: 'Sonorização de cerimônia (região-base)', amount, metadata: { section: `§${sec.number}` } });
      } else if (/regiao, deslocamento|deslocamento e logistica/.test(title)) {
        const band = /\*{0,2}(R\$\s*[\d.,]+)\s*de deslocamento da banda/i.exec(body);
        const sound = /(R\$\s*[\d.,]+)\s*de deslocamento da equipe de som/i.exec(body);
        if (band) push({ category: 'transport', item_key: 'band_trip', label: 'Deslocamento da banda (fora da região-base, até ~2h)', amount: parseMoney(band[1]), metadata: { section: `§${sec.number}` } });
        if (sound) push({ category: 'transport', item_key: 'sound_trip', label: 'Deslocamento da equipe de som', amount: parseMoney(sound[1]), metadata: { section: `§${sec.number}` } });
      } else if (/exclusive/.test(title)) {
        const visit = /visita t[eé]cnica[^.]*?salvador\s*\*{0,2}(R\$\s*[\d.,]+)/i.exec(body);
        if (visit) push({ category: 'other', item_key: 'service:technical_visit_base', label: 'Visita técnica presencial em Salvador', amount: parseMoney(visit[1]), metadata: { section: `§${sec.number}` } });
      }
    }
  }
  return out.filter((p) => Number.isFinite(p.amount));
}

// Seção → tipo de conhecimento. Seções de especificação técnica do sistema não viram conhecimento.
const SECTION_KIND = [
  { re: /identidade|postura/, kind: 'style', intents: [] },
  { re: /entrada comercial|qualificacao/, kind: 'response', intents: ['pricing', 'formation'] },
  { re: /formacoes|orientacao musical/, kind: 'faq', intents: ['formation'] },
  { re: /tabelas de cerimonia/, kind: 'rule', intents: ['pricing'] },
  { re: /regiao|deslocamento/, kind: 'policy', intents: ['location', 'pricing'] },
  { re: /sonorizacao/, kind: 'policy', intents: ['rider', 'pricing'] },
  { re: /receptivo/, kind: 'policy', intents: ['pricing', 'formation'] },
  { re: /avulsas|por tempo/, kind: 'policy', intents: ['pricing', 'availability'] },
  { re: /cache|margem/, kind: 'rule', intents: ['pricing'], internalOnly: true },
  { re: /negociacao|pagamento/, kind: 'policy', intents: ['payment', 'pricing'] },
  { re: /exclusive|eventos especiais/, kind: 'policy', intents: ['pricing'] },
  { re: /follow-up/, kind: 'rule', intents: [] },
  { re: /participantes|permiss/, kind: 'rule', intents: ['contract'] },
  { re: /fechamento|pre-contrato|assinatura/, kind: 'rule', intents: ['contract'] },
  { re: /validade|lembretes/, kind: 'policy', intents: ['contract'] },
  { re: /pos-venda|repertorio/, kind: 'post_sale', intents: ['repertoire', 'meeting'] },
  { re: /agenda|horarios|atrasos/, kind: 'policy', intents: ['availability'] },
  { re: /financeiro/, kind: 'rule', intents: ['payment'] },
  { re: /transferencia|aprendizado/, kind: 'rule', intents: [] },
  { re: /exemplos de mensagens/, kind: 'style', intents: [], perSubsection: true },
];
// Seções do manual são regras completas (listas de passos): limite maior que o das extrações de contrato.
export const MANUAL_SECTION_MAX = 2000;
const SKIP = /painel de supervisao|integracao tecnica|indicadores|pendencias/;

function sectionText(lines) {
  return lines.join('\n')
    .replace(/^\s*\|.*$/gm, '') // tabelas viram propostas de preço
    .replace(/[*_>`#]/g, '')
    .replace(/\n{2,}/g, '\n').trim();
}

/** Sugestões de conhecimento (pendentes) por seção do manual. */
export async function extractKnowledgeFromManual(sections, { version = 'v2.1' } = {}) {
  const items = [];
  for (const sec of sections) {
    const t = norm(sec.title);
    if (SKIP.test(t)) continue;
    const map = SECTION_KIND.find((m) => m.re.test(t));
    if (!map) continue;
    if (map.internalOnly) {
      items.push({
        item_key: `manual-${version}-s${sec.number}-sigilo`, kind: 'rule', priority: 95, intents: ['pricing'],
        title: 'Sigilo comercial (cachês e margens)',
        content: 'Nunca informe ao cliente cachês internos, custos, resultado ou margens da empresa. Valores ao cliente vêm só de calcular_orcamento; exceções de preço vão para aprovação.',
        metadata: { origin: { table: 'manual', id: version, field: `§${sec.number}`, imported_by: 'manual_import' }, review: { flags: [], reasons: [], required: false } },
      });
      continue;
    }
    const blocks = map.perSubsection ? sec.subs.map((s) => ({ number: s.number, title: s.title, lines: s.lines })) : [{ number: sec.number, title: sec.title, lines: [...sec.lines, ...sec.subs.flatMap((s) => [`${s.title}:`, ...s.lines])] }];
    for (const b of blocks) {
      const raw = sectionText(b.lines);
      if (!raw) continue;
      const pending = /PENDENTE/.test(raw);
      const clean = sanitizeStaticText(raw.replace(/PENDENTE:?/g, 'A validar:'), { maxLen: MANUAL_SECTION_MAX });
      if (!clean.text) continue;
      const ref = (await sha256Hex(`${version}:${b.number}:${b.title}`)).slice(0, 6);
      items.push({
        item_key: `manual-${version}-s${String(b.number).replace(/\./g, '-')}-${ref}`,
        kind: map.kind, priority: map.kind === 'rule' ? 80 : 60, intents: map.intents,
        title: `${b.title} (Manual ${version} §${b.number})`,
        content: clean.text,
        metadata: {
          origin: { table: 'manual', id: version, field: `§${b.number}`, imported_by: 'manual_import' },
          removed_dynamic: clean.removed,
          review: pending
            ? { flags: ['manual_pending'], reasons: ['O manual marca este tema como PENDENTE de validação.'], required: true }
            : { flags: [], reasons: [], required: false },
        },
      });
    }
  }
  return items;
}

// Chaves antigas equivalentes nas regras oficiais (mesmo significado, nome anterior).
const OFFICIAL_ALIASES = { 'transport|band_trip': 'standard_trip', 'musician_fee|musician_local': 'ceremony_local', 'musician_fee|musician_outside': 'outside_base' };
const REVIEW_NOTES = {
  new: 'Item novo (sem regra oficial).',
  identical: 'Idêntico à regra oficial vigente: aprovar não muda nada (pode rejeitar como duplicado).',
  same_value_new_key: 'Mesmo valor da regra oficial equivalente (chave antiga); a IA usa a chave nova.',
  differs: 'Diverge do valor da regra oficial vigente: aprovar com nova vigência passa a valer para eventos a partir dessa data.',
  conflict: 'Mesmo valor de uma regra oficial, mas com vigência diferente: confirme a vigência antes de aprovar.',
};

/** Compara uma proposta com as regras oficiais (quote_price_rules) para organizar a aprovação. */
export function compareWithOfficial(p, rules = []) {
  const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);
  const alias = OFFICIAL_ALIASES[`${p.category}|${p.item_key}`];
  const direct = rules.filter((r) => r.category === p.category && r.item_key === p.item_key);
  const same = direct.length ? direct : rules.filter((r) => alias && r.category === p.category && r.item_key === alias);
  const official = same.map((r) => ({ amount: Number(r.amount), valid_from: day(r.valid_from), valid_until: day(r.valid_until) }))
    .sort((a, b) => String(a.valid_from).localeCompare(String(b.valid_from)));
  let status = 'new';
  if (official.length) {
    const equal = official.filter((r) => r.amount === Number(p.amount));
    if (!direct.length) status = equal.length ? 'same_value_new_key' : 'differs';
    else if (!equal.length) status = 'differs';
    else status = !p.metadata?.pending_validity && equal.some((r) => r.valid_until === (day(p.valid_until) || null)) ? 'identical' : 'conflict';
  }
  return { official, review: { status, note: REVIEW_NOTES[status] } };
}

/** Importa: conhecimento + propostas de preço, tudo pendente e idempotente. */
export async function importManual({ supabase, workspaceId, markdown, actor = null, dryRun = true, version = 'v2.1' }) {
  const sections = splitSections(markdown);
  if (!sections.length) return { ok: false, error: 'Nenhuma seção "## N. Título" encontrada.' };
  const knowledge = await extractKnowledgeFromManual(sections, { version });
  const pricing = extractPricingProposals(sections).map((p) => ({ ...p, source: `manual_${version}` }));
  const [{ data: existingK }, { data: existingP }, { data: officialRules }] = await Promise.all([
    supabase.from('ai_knowledge_items').select('item_key').eq('workspace_id', workspaceId),
    supabase.from('ai_pricing_proposals').select('category, item_key, valid_from, valid_until, source').eq('workspace_id', workspaceId),
    supabase.from('quote_price_rules').select('category, item_key, amount, valid_from, valid_until').eq('workspace_id', workspaceId),
  ]);
  for (const p of pricing) {
    const { official, review } = compareWithOfficial(p, officialRules || []);
    p.metadata = { ...(p.metadata || {}), official, review };
  }
  const kKeys = new Set((existingK || []).map((e) => e.item_key));
  const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10));
  const pKey = (e) => `${e.source}|${e.category}|${e.item_key}|${day(e.valid_from)}|${day(e.valid_until)}`;
  const pKeys = new Set((existingP || []).map(pKey));
  const newK = knowledge.filter((k) => !kKeys.has(k.item_key));
  const newP = pricing.filter((p) => !pKeys.has(pKey(p)));
  if (!dryRun) {
    for (const k of newK) {
      await supabase.rpc('ai_knowledge_propose', {
        p_workspace_id: workspaceId, p_item_key: k.item_key, p_kind: k.kind, p_title: k.title, p_content: k.content,
        p_intents: k.intents, p_keywords: [], p_metadata: k.metadata, p_priority: k.priority, p_source: 'import', p_actor: actor,
      });
    }
    if (newP.length) {
      await supabase.from('ai_pricing_proposals').insert(newP.map((p) => ({
        workspace_id: workspaceId, source: p.source, category: p.category, item_key: p.item_key, label: p.label,
        amount: p.amount, valid_from: p.valid_from || null, valid_until: p.valid_until || null, metadata: p.metadata || {},
      })));
    }
  }
  return {
    ok: true, dryRun,
    knowledge: newK.map((k) => ({ item_key: k.item_key, kind: k.kind, title: k.title, review: k.metadata.review })),
    pricing: newP.map((p) => ({ category: p.category, item_key: p.item_key, label: p.label, internal: Boolean(p.metadata?.internal), pending_validity: Boolean(p.metadata?.pending_validity), valid_until: p.valid_until || null, review: p.metadata?.review?.status || null })),
    skipped: { knowledge: knowledge.length - newK.length, pricing: pricing.length - newP.length },
  };
}
