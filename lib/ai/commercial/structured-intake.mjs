/**
 * Parses only the explicitly structured "Monte sua Banda" request copied by
 * a client from the Harmonics website. Does NOT attempt to interpret ordinary
 * free-form WhatsApp messages, which remain the conversational model's job.
 * This costs zero additional model calls and never assigns prices/actions.
 */
// High-confidence Salvador neighborhood hints only; never infer a venue's city from its name alone.
export function cityFromKnownNeighborhood(place = '') {
  const value = String(place || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const neighborhoods = ['stella maris', 'stela maris', 'pituba', 'ribeira', 'itapua', 'barra', 'ondina', 'rio vermelho', 'amaralina', 'brotas', 'caminho das arvores', 'patamares', 'piatã', 'piata', 'jardim armacao', 'imbui'];
  const found = neighborhoods.some(n => new RegExp('(?:^|[^a-z])' + n + '(?:$|[^a-z])').test(value));
  const explicitOtherCity = /\b(cam[aá]çari|lauro de freitas|feira de santana|sim[oõ]es filho|dias d.avila)\b/i.test(String(place || ''));
  return found && !explicitOtherCity ? 'Salvador' : null;
}
const tidy = (text) => String(text || '').replace(/\u200e|\u200f/g, '').trim();
const strip = (value) => tidy(value).replace(/^\\*+|\\*+$/g, '').trim().slice(0, 180);
// Website WhatsApp copy uses emojis and Markdown asterisks before labels.
const normalizedLines = (text) => String(text || '').split(/\\r?\\n/).map(line =>
  line.replace(/^[^\\p{L}\\p{N}]+/u, '').replace(/\\*/g, '').trim());
const lineValue = (text, name) => {
  const pattern = new RegExp('^' + name + '\\\\s*:\\\\s*(.*)$', 'i');
  const found = normalizedLines(text).find(line => pattern.test(line));
  return strip(found ? pattern.exec(found)?.[1] : '');
};
const sectionValue = (text, name) => {
  const lines = normalizedLines(text);
  const pattern = new RegExp('^' + name + '\\\\s*:\\\\s*(.*)$', 'i');
  const index = lines.findIndex(line => pattern.test(line));
  if (index < 0) return '';
  const inline = strip(pattern.exec(lines[index])?.[1]);
  return inline || strip(lines.slice(index + 1).find(Boolean) || '');
};
function isoDate(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const day = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0,10) === iso ? iso : null;
}
export function parseStructuredEventRequest(input) {
  const text = tidy(input);
  if (!/NOVO (?:PEDIDO DE )?OR[ÇC]AMENTO\s*[—-]\s*HARMONICS/i.test(text)
    || !/DADOS DO EVENTO\s*:/i.test(text)) return null;
  const result = {};
  const name = lineValue(text, 'Nome dos noivos\\s*\\/\\s*respons[aá]vel') || lineValue(text, 'Nome');
  const type = lineValue(text, 'Tipo');
  const date = isoDate(lineValue(text, 'Data'));
  const time = lineValue(text, 'Hor[aá]rio');
  const city = lineValue(text, 'Cidade');
  const place = lineValue(text, 'Local');
  const formation = sectionValue(text, 'FORMA[ÇC][ÃA]O SELECIONADA');
  const instruments = sectionValue(text, 'INSTRUMENTOS E VOZES') || sectionValue(text, 'INSTRUMENTOS\\/VOZES');
  const experience = lineValue(text, 'Experi[eê]ncia');
  const sound = sectionValue(text, 'SONORIZA[ÇC][ÃA]O PROFISSIONAL');
  if (name && name.length < 130) result.nome = name;
  if (type && type.length < 100) result.tipo_evento = type;
  if (date) result.data_evento = date;
  if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) result.horario = time;
  if (city && city.length < 100) result.cidade = city;
  else if (place) result.cidade = /^salvador(?:\\s*[,/-]\\s*ba)?$/i.test(place) ? 'Salvador' : cityFromKnownNeighborhood(place) || undefined;
  if (place && place.length < 180) result.local = place;
  if (formation && formation.length < 100) result.formacao = formation;
  if (instruments && instruments.length < 180) result.instrumentos = instruments;
  const reception = /(?:\+|e|com)\s*(\d)\s*h(?:oras?)?\s*de\s*receptivo/i.exec(experience);
  if (reception) result.recepcao_horas = reception[1];
  if (/n[aã]o incluir|sem som|dispensar/i.test(sound)) result.som = 'não';
  else if (/incluir|adicionar|solicitad[ao]|com som/i.test(sound)) result.som = 'sim';
  return Object.keys(result).length ? result : null;
}
