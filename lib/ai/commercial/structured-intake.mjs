/**
 * Parses only the explicitly structured "Monte sua Banda" request copied by
 * a client from the Harmonics website. Does NOT attempt to interpret ordinary
 * free-form WhatsApp messages, which remain the conversational model's job.
 * This costs zero additional model calls and never assigns prices/actions.
 */
const tidy = (text) => String(text || '').replace(/\u200e|\u200f/g, '').trim();
const strip = (value) => tidy(value).slice(0, 180);
const lineValue = (text, name) => {
  const pattern = new RegExp('^\\s*(?:[-*]\\s*)?' + name + '\\s*:\\s*(.*)$', 'im');
  return strip(pattern.exec(text)?.[1] || '');
};
const sectionValue = (text, name) => {
  const pattern = new RegExp('^\\s*' + name + '\\s*:\\s*(.*)$', 'im');
  const m = pattern.exec(text);
  if (!m) return '';
  if (m[1]?.trim()) return strip(m[1]);
  const tail = text.slice(m.index + m[0].length);
  const next = tail.split(/\r?\n/).map(tidy).find(Boolean);
  return strip(next || '');
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
  if (!/NOVO PEDIDO DE OR[ÇC]AMENTO\s*[—-]\s*HARMONICS/i.test(text)
    || !/DADOS DO EVENTO\s*:/i.test(text)) return null;
  const result = {};
  const name = lineValue(text, 'Nome dos noivos\\s*\\/\\s*respons[aá]vel');
  const type = lineValue(text, 'Tipo');
  const date = isoDate(lineValue(text, 'Data'));
  const time = lineValue(text, 'Hor[aá]rio');
  const city = lineValue(text, 'Cidade');
  const place = lineValue(text, 'Local');
  const formation = sectionValue(text, 'FORMA[ÇC][ÃA]O SELECIONADA');
  const instruments = sectionValue(text, 'INSTRUMENTOS E VOZES');
  const experience = lineValue(text, 'Experi[eê]ncia');
  const sound = sectionValue(text, 'SONORIZA[ÇC][ÃA]O PROFISSIONAL');
  if (name && name.length < 130) result.nome = name;
  if (type && type.length < 100) result.tipo_evento = type;
  if (date) result.data_evento = date;
  if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) result.horario = time;
  if (city && city.length < 100) result.cidade = city;
  if (place && place.length < 180) result.local = place;
  if (formation && formation.length < 100) result.formacao = formation;
  if (instruments && instruments.length < 180) result.instrumentos = instruments;
  const reception = /(?:\+|e|com)\s*(\d)\s*h(?:oras?)?\s*de\s*receptivo/i.exec(experience);
  if (reception) result.recepcao_horas = reception[1];
  if (/incluir|adicionar|solicitad[ao]|com som/i.test(sound)) result.som = 'sim';
  else if (/n[aã]o incluir|sem som|dispensar/i.test(sound)) result.som = 'não';
  return Object.keys(result).length ? result : null;
}
