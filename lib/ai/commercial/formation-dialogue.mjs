// Progressão da conversa comercial. Responder ao aceite do cliente é mais importante
// do que repetir pendências de preço ou oferecer novamente as mesmas opções.
const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function formationIntent(text = '', previousAssistantText = '') {
  const latest = norm(text);
  if (/\b(me mostre|mostra|mostrar|me manda|manda|envia|quais sao|quais as|opcoes|formacoes|instrumentos|pode mostrar)\b/.test(latest) &&
    /\b(opcoes|formacoes|duo|trio|quarteto|quinteto|sexteto|instrumentos)\b/.test(latest)) return 'show_options';
  const accepted = /^(ok|okay|sim|pode|pode sim|claro|quero|quero sim|por favor|isso|beleza|blz|manda|mostra|pode mandar|pode mostrar|pode enviar)[.!\s]*$/.test(latest);
  if (accepted && /\b(mostr\w*|apresent\w*|envi\w*|mand\w*|opcoes|formacoes|duo a sexteto|escolher a formacao)\b/.test(norm(previousAssistantText))) return 'show_options';
  return null;
}
export const FORMATIONS = Object.freeze([
  ['Duo', 'voz e piano'],
  ['Trio', 'voz, violino e violão ou piano'],
  ['Quarteto', 'voz, piano, violão e violino'],
  ['Quinteto', 'voz, piano, violão, violino e saxofone'],
  ['Sexteto', 'voz, piano, violão, violino, saxofone e percussão'],
]);
export function formationOptionsReply({ city = '', withPendingPricing = false } = {}) {
  const options = FORMATIONS.map(([name, instruments]) => '• ' + name + ' — ' + instruments).join('\n');
  const intro = 'Claro! ☺️ Para a cerimônia, temos estas opções de formação:\n\n' + options;
  const next = '\n\nQual dessas combina mais com o que você imagina para o casamento?';
  // Uma informação comercial relevante só no momento oportuno, sem promessa de tarefa executada.
  return intro + (withPendingPricing ? '\n\nOs valores para ' + city + ' ainda precisam ser confirmados antes de fecharmos a proposta.' : '') + next;
}
export function containsInternalLeak(text = '') {
  return /tabela (?:oficial )?(?:autom[aá]tica|cadastrada)|n[aã]o (?:tem|temos|existe|est[aá]) (?:uma? )?tabela|tabela.{0,50}(?:sistema|base|cadastr)|(?:sistema|base de dados|cadastro interno|parametriz|ferramenta interna).{0,65}(?:valor|pre[cç]o|tabela|or[cç]amento)|na nossa base|nossa base|nosso banco|precisamos cadastrar|ainda n[aã]o est[aá] parametriz/i.test(String(text));
}

/**
 * Evita expor configuração interna, prometer encaminhamento ou repetir oferta
 * já aceita. Não acrescenta preços: apenas retoma a conversa.
 */
export function guardCommercialReply({ reply = '', city = '', latestCustomer = '', previousAssistant = '', pricingPending = false } = {}) {
  const original = String(reply || '').trim();
  if (!city || !pricingPending) return original;
  // Uma aceitação direta da oferta anterior pede uma resposta concreta, não outra pergunta.
  if (formationIntent(latestCustomer, previousAssistant) === 'show_options') {
    return formationOptionsReply({ city });
  }
  const repeatsOffer = /(?:posso|quer(?:e|ia)?|gostaria).{0,90}(?:mostrar|apresentar|formac|op[cç][oõ]es|escolher)/i.test(original)
    && /(?:posso|quer(?:e|ia)?|gostaria).{0,90}(?:mostrar|apresentar|formac|op[cç][oõ]es|escolher)/i.test(previousAssistant);
  if (repeatsOffer) return formationOptionsReply({ city });
  if (containsInternalLeak(original) || /(?:equipe|setor).{0,60}(?:vai|ir[aá]|j[aá]).{0,55}(?:retornar|confirmar|entrar em contato)/i.test(original)) {
    return 'Entendi! Para ' + city + ', vou precisar conferir os valores antes de te passar um orçamento certinho. ☺️ Enquanto isso, posso te mostrar as opções de formação para a cerimônia.';
  }
  return original;
}
