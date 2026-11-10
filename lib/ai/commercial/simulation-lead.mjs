export function inferSimulationLead(messages = [], saved = {}) {
  const out = eventData(saved);
  const userTexts = messages.filter((m) => m.role === 'user').map((m) => m.content || '');
  for (const content of userTexts) {
    const date = content.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
    if (date && !out.data_evento) out.data_evento = `${date[3]}-${date[2].padStart(2, '0')}-${date[1].padStart(2, '0')}`;
    const venue = content.match(/\b(?:na|no|em)\s+((?:ch[aá]cara|s[ií]tio|fazenda|espa[cç]o|sal[aã]o|igreja|capela|buffet|hotel|pousada|recanto)\s+[^,.!?;]+?)(?=\s+(?:dia|em|às|as)\s+\d|[,.!?;]|$)/i);
    const correction = /\b(na verdade|corrigindo|corre[cç][aã]o|me enganei|na realidade|mudei o local|mudou o local)\b/i.test(content);
    if (venue && (!out.local || correction)) {
      const named = venue[1].trim();
      const cityPart = named.match(/^(.*?)\s+em\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]{2,60})$/i);
      out.local = (cityPart ? cityPart[1] : named).slice(0, 120);
      if (correction) delete out.cidade;
      if (cityPart) out.cidade = cityPart[2].trim().slice(0, 80);
    }
    // Aceita cidade informada sozinha: "Salvador", "Feira de Santana", "Camaçari".
    // Não extrai bairro isolado nem um nome de espaço como se fosse cidade.
    const compact = content.trim().replace(/[.!?]+$/, '');
    const cityAlone = /^(?:em|na cidade de|fica em|é em)?\s*(Salvador|Feira de Santana|Camaçari|Lauro de Freitas|Simões Filho|Dias d'Ávila|Mata de São João)(?:\s*[-,]\s*(?:Bahia|BA))?$/i.exec(compact);
    if (cityAlone) out.cidade = cityAlone[1];
    const city = content.match(/\b(?:fica|ser[aá]|[ée])\s+em\s+([A-Za-zÀ-ÿ][^.,!?;]{2,70})/i);
    if (city && !/\b(ch[aá]cara|s[ií]tio|igreja|sal[aã]o|espa[cç]o)\b/i.test(city[1])) out.cidade = city[1].trim().replace(/\s+bahia$/i, '').slice(0, 80);
    // Se a pessoa informou endereço do espaço, deixe a conversa avançar sem repetir a pergunta.
    const address = content.match(/\b(rua|avenida|estrada|rodovia|travessa|alameda|bairro)\b[^.!?;]{4,120}/i);
    if (address && out.local && !out.local.toLowerCase().includes(address[0].toLowerCase())) {
      out.local = `${out.local}, ${address[0].trim()}`.slice(0, 150);
    }
  }
  return out;
}

export function eventData(raw) {
  const fields = ['tipo_evento', 'data_evento', 'horario', 'local', 'cidade', 'formacao', 'instrumentos', 'som', 'recepcao_formacao', 'recepcao_horas'];
  const data = {};
  for (const key of fields) if (typeof raw?.[key] === 'string') data[key] = raw[key].slice(0, 150);
  return data;
}
