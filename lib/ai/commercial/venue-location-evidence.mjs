// Verificação independente da localização enviada pelo cliente (sem inventar endereço/cidade).
// Nunca faz fetch de URLs fornecidas pelo usuário; apenas serviços predefinidos.
const zipPattern = /\b(\d{5})-?(\d{3})\b/;
export function extractLocationEvidence(text = '') {
  const raw = String(text).slice(0, 1000);
  const cep = raw.match(zipPattern);
  if (cep) return { type: 'cep', value: cep[1] + cep[2] };
  const coordinate = raw.match(/(?:[?&](?:q|query|ll)=|@)(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/i)
    || raw.match(/(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/);
  if (coordinate) {
    const lat = Number(coordinate[1]), lon = Number(coordinate[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
      return { type: 'coordinates', lat, lon };
  }
  const address = raw.match(/\b(?:rua|avenida|av\.|estrada|rodovia|travessa|alameda)\s+[^.!?;]{5,160}/i);
  if (address) return { type: 'address', value: address[0].trim() };
  return null;
}
const tidy = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const safeCity = (r) => String(r?.city || r?.town || r?.municipality || r?.village || '').trim();
export async function verifyLocationEvidence(evidence, { fetchImpl = fetch } = {}) {
  if (!evidence) return { status: 'insufficient' };
  try {
    if (evidence.type === 'cep') {
      const response = await fetchImpl('https://viacep.com.br/ws/' + evidence.value + '/json/', {
        signal: AbortSignal.timeout(5500), headers: { Accept: 'application/json' },
      });
      if (!response.ok) return { status: 'unavailable' };
      const data = await response.json();
      if (data.erro || !data.localidade || !data.uf) return { status: 'not_found' };
      return { status: 'confirmed', city: data.localidade, uf: data.uf,
        detail: [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean).join(', '),
        precision: 'cep', source: 'ViaCEP' };
    }
    const params = new URLSearchParams(evidence.type === 'coordinates'
      ? { lat: String(evidence.lat), lon: String(evidence.lon), format: 'jsonv2', addressdetails: '1', 'accept-language': 'pt-BR' }
      : { q: evidence.value + ', Bahia, Brasil', format: 'jsonv2', addressdetails: '1',
        countrycodes: 'br', limit: '3', 'accept-language': 'pt-BR' });
    const path = evidence.type === 'coordinates' ? 'reverse' : 'search';
    const response = await fetchImpl('https://nominatim.openstreetmap.org/' + path + '?' + params, {
      headers: { Accept: 'application/json', 'User-Agent': 'Harmonics-Nara/1.0 (https://bandaharmonics.com)' },
      signal: AbortSignal.timeout(5500),
    });
    if (!response.ok) return { status: 'unavailable' };
    const result = await response.json();
    const candidates = Array.isArray(result) ? result : [result];
    const withCity = candidates.map((x) => ({ x, city: safeCity(x.address),
      state: tidy(x.address?.state), country: x.address?.country_code })).filter((x) => x.city && x.country === 'br');
    if (withCity.length !== 1) return { status: withCity.length ? 'ambiguous' : 'not_found' };
    const item = withCity[0];
    return { status: 'confirmed', city: item.city, uf: item.state === 'bahia' ? 'BA' : null,
      detail: String(item.x.display_name || '').slice(0, 220),
      precision: evidence.type === 'coordinates' ? 'coordinates' : 'address',
      source: 'OpenStreetMap' };
  } catch { return { status: 'unavailable' }; }
}
