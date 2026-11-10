// Progressão da conversa comercial. Responder ao aceite do cliente é mais importante
// do que repetir pendências de preço ou oferecer novamente as mesmas opções.
const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function formationIntent(text = '', previousAssistantText = '') {
  const latest = norm(text);
  if (/\b(me mostre|mostra|mostrar|me manda|manda|envia|quais sao|quais as|opcoes|formacoes|instrumentos|pode mostrar)\b/.test(latest) &&
    /\b(opcoes|formacoes|duo|trio|quarteto|quinteto|sexteto|instrumentos)\b/.test(latest)) return 'show_options';
  const accepted = /^(ok|okay|sim|pode|pode sim|claro|quero|quero sim|por favor|isso|beleza|blz|manda|mostra|pode mandar|pode mostrar|pode enviar)[.!\s]*$/.test(latest);
  if (accepted && /\b(mostr|apresent|envia|mand|opcoes|formacoes|duo a sexteto)\b/.test(norm(previousAssistantText))) return 'show_options';
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
  return /tabela automatica|tabela automática|na nossa base|nossa base|nosso banco|parametriz|sistema interno|cadastro interno|ferramenta interna/i.test(text);
}
