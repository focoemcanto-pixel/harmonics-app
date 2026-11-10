// Memória permanente de espaços (ai_venues): pesquisar/confirmar uma vez e reutilizar nos próximos atendimentos.
// Regras: só entradas VERIFICADAS (Owner, ou mapas quando o Owner autorizar) classificam sozinhas; relatos de
// clientes ficam "client_reported" para conferência. Homônimos (mesmo nome em cidades diferentes) nunca são
// confundidos: sem cidade que desempate, a Nara pergunta a cidade.
import { otherStateIn } from './geo.mjs';

export const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

const LEADING = /^(na|no|nas|nos|em|a|o|as|os|do|da)\s+/;
const VENUE_WORD = /\b(chacara|sitio|fazenda|espaco|salao|igreja|capela|paroquia|catedral|basilica|santuario|buffet|casa de (festas?|eventos)|clube|hotel|resort|pousada|restaurante|condominio|recanto|quinta|rancho|mansao|villa|vila|haras|estancia|cerimonial|templo|mosteiro|convento|lounge|galpao|terraco|rooftop)\b/;
const SPLIT = /,|\s[-–/]\s|\sem\s/;

/** Nome normalizado do espaço (sem artigo/preposição inicial). */
export function venueKey(name) {
  let s = norm(name);
  while (LEADING.test(s)) s = s.replace(LEADING, '');
  return s;
}

/** "Chácara X, Cidade - UF" -> { venue: 'Chácara X', city: 'Cidade', uf } (cidade só se veio no texto ou no lead). */
export function splitVenueText(local, cidade) {
  const raw = String(local || '').trim();
  const parts = raw.split(SPLIT).map((p) => p.trim()).filter(Boolean);
  const venue = (parts[0] || '').replace(/^(na|no|nas|nos|em)\s+/i, '').trim();
  let city = String(cidade || '').trim() || (parts.length > 1 ? parts[1] : '');
  let uf = null;
  const ufTail = /\s*[-/]\s*([A-Z]{2})$|\s([A-Z]{2})$/.exec(city) || (parts.length > 2 && /^[A-Z]{2}$/.test(parts[2]) ? [null, parts[2]] : null);
  if (ufTail) { uf = ufTail[1] || ufTail[2]; city = city.replace(/\s*[-/]?\s*[A-Z]{2}$/, '').trim(); }
  return { venue, city, uf };
}

const containsTerm = (text, term) => term && ` ${text} `.includes(` ${term} `);

/**
 * Busca na memória (pura). Retorna:
 *  - { kind: 'venue', venue }      um único espaço verificado compatível;
 *  - { kind: 'ambiguous', name, venues } mesmo nome em cidades diferentes, sem cidade para desempatar;
 *  - { kind: 'none' }              nada verificado (ou homônimo em outra cidade: é outro lugar).
 */
export function findVenue(venues = [], { local = '', cidade = '' } = {}) {
  const text = venueKey(local);
  if (!text) return { kind: 'none' };
  const candidates = venues.filter((v) => v && v.status === 'verified'
    && [v.name_norm || venueKey(v.name), ...(v.aliases || []).map(venueKey)].some((t) => containsTerm(text, t)));
  if (!candidates.length) return { kind: 'none' };
  const { city } = splitVenueText(local, cidade);
  const cityHint = norm(city);
  if (cityHint) {
    const same = candidates.filter((v) => (v.city_norm || norm(v.city)) === cityHint);
    if (same.length === 1) return { kind: 'venue', venue: same[0] };
    if (same.length > 1) return { kind: 'ambiguous', name: same[0].name, venues: same };
    return { kind: 'none' };
  }
  const cities = new Set(candidates.map((v) => `${v.city_norm || norm(v.city)}|${v.uf || 'BA'}`));
  if (cities.size === 1 && candidates.length === 1) return { kind: 'venue', venue: candidates[0] };
  return { kind: 'ambiguous', name: candidates[0].name, venues: candidates };
}

/** Texto de local para o classificador: usa a localidade vinculada, senão a cidade (e a UF fora da Bahia). */
export function venueLocation(venue, areas = []) {
  const area = venue.area_id ? areas.find((a) => a.id === venue.area_id && a.active !== false) : null;
  const place = area?.name || venue.city;
  return `${venue.name}, ${place}${venue.uf && venue.uf !== 'BA' ? ` - ${venue.uf}` : ''}`;
}

/**
 * Registro de um espaço informado pela cliente (nome + cidade), para o Owner conferir. Não grava se não há nome
 * de espaço, cidade ou se a UF não pôde ser determinada com segurança (nada é presumido).
 */
export function venueReport({ local = '', cidade = '', analysis = null, conversationId = null } = {}) {
  if (!analysis || !['area', 'other_state', 'unregistered'].includes(analysis.kind)) return null;
  const { venue, city, uf: ufText } = splitVenueText(local, cidade);
  if (!venue || !city || !VENUE_WORD.test(norm(venue))) return null;
  let uf = ufText;
  if (!uf) {
    const st = otherStateIn(`${venue}, ${city}`);
    if (st) uf = /^[A-Z]{2}$/.test(st) ? st : STATE_UF[st] || null;
    else uf = 'BA';
  }
  if (!uf) return null;
  return {
    name: venue.slice(0, 120), name_norm: venueKey(venue), city: city.slice(0, 80), city_norm: norm(city), uf,
    area_id: analysis.kind === 'area' ? analysis.area?.id || null : null,
    status: 'client_reported', source: 'client_message', last_conversation_id: conversationId,
  };
}

const STATE_UF = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', ceara: 'CE', 'distrito federal': 'DF', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'minas gerais': 'MG', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
  'belo horizonte': 'MG', recife: 'PE', aracaju: 'SE', maceio: 'AL', fortaleza: 'CE', brasilia: 'DF', goiania: 'GO', curitiba: 'PR',
  florianopolis: 'SC', 'porto alegre': 'RS', 'joao pessoa': 'PB', teresina: 'PI', belem: 'PA', manaus: 'AM', cuiaba: 'MT',
};

/** Entrada do Owner (Central): valida e normaliza. Verificar exige cidade e UF; coordenadas opcionais e validadas. */
export function parseVenueInput(body = {}, { actor = null, now = new Date().toISOString() } = {}) {
  const name = String(body.name || '').trim().slice(0, 120);
  const city = String(body.city || '').trim().slice(0, 80);
  const uf = String(body.uf || 'BA').trim().toUpperCase();
  if (!name || !city) return { error: 'Informe o nome do espaço e a cidade.' };
  if (!/^[A-Z]{2}$/.test(uf)) return { error: 'UF inválida.' };
  const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
  const lat = num(body.lat); const lng = num(body.lng);
  if ((lat != null && !(lat >= -90 && lat <= 90)) || (lng != null && !(lng >= -180 && lng <= 180)) || (lat == null) !== (lng == null)) {
    return { error: 'Coordenadas inválidas (informe latitude e longitude).' };
  }
  const aliases = [...new Set((Array.isArray(body.aliases) ? body.aliases : String(body.aliases || '').split(','))
    .map((a) => String(a).trim()).filter(Boolean))].slice(0, 20);
  const status = ['verified', 'client_reported', 'rejected'].includes(body.status) ? body.status : 'verified';
  return {
    name, name_norm: venueKey(name), aliases, address: String(body.address || '').trim().slice(0, 240) || null,
    city, city_norm: norm(city), uf, lat, lng, area_id: body.area_id || null,
    status, source: body.source && ['owner', 'client_message', 'whatsapp_location', 'maps'].includes(body.source) ? body.source : 'owner',
    notes: String(body.notes || '').trim().slice(0, 500) || null,
    ...(status === 'verified' ? { verified_at: now, verified_by: actor } : { verified_at: null, verified_by: null }),
  };
}
