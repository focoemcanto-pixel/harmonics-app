// Inteligência geográfica da Nara (determinística, sem serviço pago de mapas):
// - só o nome do espaço (ex.: "Chácara Recanto Inventado") => perguntar a cidade, nunca presumir Salvador;
// - espaço + cidade informados em mensagens separadas => combinar antes de classificar;
// - outro estado => orçamento personalizado (aprovação do Owner);
// - classificação só por localidades cadastradas/faixas aprovadas (nunca pelo nome da cidade ou distância
//   aproximada). Rotas reais só entram se o Owner habilitar a chave de mapas (routeFn).
import { resolveTerritory } from './pricing.mjs';
import { findVenue, venueLocation, splitVenueText } from './venues.mjs';

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const VENUE = /\b(chacara|sitio|fazenda|espaco|salao|igreja|capela|paroquia|catedral|basilica|santuario|buffet|casa de (festas?|eventos)|clube|hotel|resort|pousada|restaurante|condominio|recanto|quinta|rancho|mansao|villa|vila|haras|estancia|cerimonial|templo|mosteiro|convento|praia|beach|lounge|galpao|terraco|rooftop|jardim|bosque|parque)\b/;
// Separadores que normalmente introduzem a cidade: "X, Cidade", "X - Cidade", "X / Cidade", "X em Cidade".
const CITY_SEPARATOR = /,|\s[-–/]\s|\sem\s/;

const UFS = ['AC', 'AL', 'AP', 'AM', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
// Só nomes sem homônimos comuns na Bahia (ex.: "Espírito Santo"/"Santa Catarina" são igrejas; "Campo Grande",
// "Boa Vista" e "Vitória" são bairros/cidades baianas) — na dúvida a Nara pergunta, nunca presume.
const STATE_NAMES = ['acre', 'alagoas', 'amapa', 'amazonas', 'ceara', 'distrito federal', 'goias', 'maranhao', 'mato grosso', 'minas gerais', 'paraiba', 'parana', 'pernambuco', 'piaui', 'rio de janeiro', 'rio grande do norte', 'rio grande do sul', 'rondonia', 'roraima', 'sao paulo', 'sergipe', 'tocantins'];
const STATE_CAPITALS = ['belo horizonte', 'recife', 'aracaju', 'maceio', 'fortaleza', 'brasilia', 'goiania', 'curitiba', 'florianopolis', 'porto alegre', 'joao pessoa', 'teresina', 'belem', 'manaus', 'cuiaba'];
/** Acima disso (minutos de viagem real desde Salvador) => orçamento personalizado. Até 2h30 segue as faixas aprovadas. */
export const CUSTOM_TRIP_MINUTES = 150;

/** UF/estado diferente da Bahia citado no local (ex.: "Recife - PE", "Aracaju, Sergipe"). */
export function otherStateIn(text) {
  const raw = String(text || '');
  const uf = new RegExp(`(?:[,/–-]\\s*|\\s)(${UFS.join('|')})\\s*$`).exec(raw.trim());
  if (uf) return uf[1];
  const t = norm(raw);
  const name = STATE_NAMES.find((s) => new RegExp(`(^|[\\s,/-])${s}($|[\\s,/-])`).test(t));
  if (name) return name;
  const capital = STATE_CAPITALS.find((c) => new RegExp(`(^|[\\s,/-])${c}($|[\\s,/-])`).test(t));
  return capital || null;
}

/** Local completo para classificar: espaço + cidade quando vieram separados. */
export function composeLocation(local, cidade) {
  const l = String(local || '').trim();
  const c = String(cidade || '').trim();
  if (!l) return c;
  if (!c || norm(l).includes(norm(c))) return l;
  return `${l}, ${c}`;
}

/**
 * Análise do local antes de cotar:
 *  - missing: nada informado;
 *  - area: localidade cadastrada (segue a faixa aprovada);
 *  - other_state: outro estado => personalizado;
 *  - ambiguous: o texto cita mais de uma localidade cadastrada => pedir endereço completo/localização;
 *  - venue_only: só o nome do espaço, sem cidade => perguntar a cidade;
 *  - unregistered: cidade/local sem cadastro => pendência para o Owner (sem valores).
 */
export function analyzeLocation({ local = '', cidade = '', areas = [] } = {}) {
  const l = String(local || '').trim();
  const c = String(cidade || '').trim();
  // O local sozinho já define a região (cidade cadastrada ou outro estado)? Então a cidade antiga do lead não entra.
  if (l && c) {
    const alone = classify(l, '', areas);
    if (alone.kind !== 'venue_only' && alone.kind !== 'unregistered') return alone;
  }
  return classify(composeLocation(l, c), c, areas, l);
}

function classify(location, cidade, areas, venueText = location) {
  if (!location) return { kind: 'missing', location };
  const state = otherStateIn(location);
  if (state) return { kind: 'other_state', location, state };
  const matches = matchingAreas(areas, location);
  if (matches.length > 1) return { kind: 'ambiguous', location, areas: matches };
  const area = resolveTerritory(areas, location);
  if (area) return { kind: 'area', location, area };
  if (VENUE.test(norm(location)) && !CITY_SEPARATOR.test(location) && !cidade) {
    return { kind: 'venue_only', location, venue: String(venueText || location).trim().slice(0, 60) };
  }
  return { kind: 'unregistered', location };
}

/**
 * Decisão antes de cotar (pura): o que a Nara faz com o local.
 *  - proceed: segue para a tabela/orçamento com `location` (já combinado);
 *  - ask: pergunta fixa (cidade, ou endereço/localização se ambíguo), SEM pendência para o Owner;
 *  - custom: orçamento personalizado (outro estado), com pendência para aprovação do Owner.
 */
export function locationGate({ local = '', cidade = '', areas = [], venues = [] } = {}) {
  // 1) Memória de espaços verificados: reutiliza sem pesquisar de novo; homônimo sem cidade => pergunta a cidade.
  const mem = findVenue(venues, { local, cidade });
  if (mem.kind === 'ambiguous') return { action: 'ask', reason: 'cidade_necessaria', location: String(local || '').trim(), text: askCityMessage(mem.name) };
  if (mem.kind === 'venue') {
    const known = analyzeLocation({ local: venueLocation(mem.venue, areas), areas });
    if (known.kind === 'other_state') return { action: 'custom', reason: 'other_state_custom', location: known.location, venue: mem.venue, text: customQuoteMessage(known.location, { otherState: true }) };
    if (known.kind === 'area' || known.kind === 'unregistered') return { action: 'proceed', location: known.location, analysis: known, venue: mem.venue };
  }
  const a = analyzeLocation({ local, cidade, areas });
  // Nome de espaço ainda não verificado: conhecer a cidade não confirma o endereço.
  // Sem busca web/rota validada, pedir localização antes de enquadrar automaticamente na faixa.
  const venuePart = splitVenueText(local, cidade);
  const venueNamed = VENUE.test(norm(venuePart.venue));
  const cityKnown = Boolean(venuePart.city);
  const addressGiven = /\b(rua|avenida|av\.?|estrada|rodovia|bairro|travessa|alameda|km\s*\d+)\b/i.test(String(local || ''));
  if (venueNamed && cityKnown && !addressGiven && (a.kind === 'area' || a.kind === 'unregistered')) {
    return { action: 'ask', reason: 'espaco_nao_verificado', location: a.location,
      text: 'Pra eu localizar o espaço certinho e não te passar um valor errado, você me manda o endereço ou a localização dele? ☺️' };
  }
  if (a.kind === 'venue_only') return { action: 'ask', reason: 'cidade_necessaria', location: a.location, text: askCityMessage(a.venue) };
  if (a.kind === 'ambiguous') return { action: 'ask', reason: 'endereco_necessario', location: a.location, text: askAddressMessage() };
  if (a.kind === 'other_state') return { action: 'custom', reason: 'other_state_custom', location: a.location, text: customQuoteMessage(a.location, { otherState: true }) };
  return { action: a.kind === 'missing' ? 'missing' : 'proceed', location: a.location, analysis: a };
}

/** Localidades cadastradas citadas no texto, descartando termos contidos em outro mais específico. */
export function matchingAreas(areas = [], locationText = '') {
  const text = ` ${norm(locationText).replace(/[^a-z0-9]+/g, ' ')} `;
  const hits = [];
  for (const area of areas) {
    if (area?.active === false) continue;
    const terms = [area.name, ...(area.match_terms || [])].map((x) => norm(x).replace(/[^a-z0-9]+/g, ' ').trim()).filter(Boolean);
    const term = terms.filter((t) => text.includes(` ${t} `)).sort((a, b) => b.length - a.length)[0];
    if (term) hits.push({ area, term });
  }
  const kept = hits.filter((h) => !hits.some((o) => o !== h && o.term.length > h.term.length && o.term.includes(h.term)));
  const ids = new Set();
  return kept.map((h) => h.area).filter((a) => { const k = a.id || a.name; if (ids.has(k)) return false; ids.add(k); return true; });
}

/** Minutos de viagem conhecidos (rota real se habilitada; senão o tempo validado da localidade). */
export function knownTravelMinutes({ area = null, routing = null } = {}) {
  const r = Number(routing?.travelMinutes);
  if (Number.isFinite(r) && r > 0) return r;
  const a = Number(area?.travel_minutes);
  return Number.isFinite(a) && a > 0 ? a : null;
}

const FEMININE = /^(chacara|fazenda|igreja|capela|paroquia|catedral|basilica|casa|pousada|quinta|mansao|villa|vila|estancia|praia)\b/;

export function askCityMessage(venue) {
  const v = String(venue || '').trim().replace(/^(na|no|em|nas|nos|a|o|as|os)\s+/i, '').replace(/[.!?]+$/, '');
  if (!v) return 'Que lindo! ☺️ Em qual cidade vai ser o evento?';
  const n = norm(v);
  const article = FEMININE.test(n) ? 'a' : VENUE.test(n.split(/\s+/)[0]) ? 'o' : null;
  return `Que lindo! ☺️ Em qual cidade fica ${article ? `${article} ${v}` : v}?`;
}

export function askAddressMessage() {
  return 'Pra eu não errar a região, você me manda o endereço completo do local ou a localização pelo WhatsApp? ☺️';
}

/** Outro estado / viagem longa / logística especial: sem valores, a equipe monta e o Owner aprova. */
export function customQuoteMessage(location, { otherState = false } = {}) {
  const place = String(location || '').trim().slice(0, 60);
  if (otherState) {
    return `A Harmonics é de Salvador, mas a gente avalia com carinho eventos ${place ? `em ${place}` : 'fora da Bahia'}! ☺️ Para esse caso montamos um orçamento personalizado: a equipe confirma os detalhes e já te retorna por aqui, tá bom?`;
  }
  return `Para ${place ? `eventos em ${place}` : 'esse local'}, a gente monta um orçamento personalizado. A equipe confirma os detalhes e já te retorna por aqui, tá bom? ☺️`;
}
