import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStructuredEventRequest } from '../../lib/ai/commercial/structured-intake.mjs';
import { buildSystemPrompt } from '../../lib/ai/agent/prompt.mjs';
import { resolveCommercialAction } from '../../lib/ai/agent/conversation-turn.mjs';

const FORM = `NOVO PEDIDO DE ORÇAMENTO — HARMONICS

DADOS DO CLIENTE:
Nome dos noivos / responsável: Casal Exemplo

DADOS DO EVENTO:
Tipo: Casamento
Data: 14/03/2027
Horário: 16:00
Local: Espaço Exemplo
Cidade: Cidade Sintética
Experiência: Cerimônia + 1h de receptivo

FORMAÇÃO SELECIONADA:
Quarteto

INSTRUMENTOS E VOZES:
Piano, Violão, Cello, Vocal Masculino

SONORIZAÇÃO PROFISSIONAL:
Incluir como serviço adicional no orçamento`;

test('website form becomes structured data in one deterministic pass', () => {
  const fields = parseStructuredEventRequest(FORM);
  assert.deepEqual(fields, {
    nome: 'Casal Exemplo', tipo_evento: 'Casamento',
    data_evento: '2027-03-14', horario: '16:00',
    cidade: 'Cidade Sintética', local: 'Espaço Exemplo',
    formacao: 'Quarteto', instrumentos: 'Piano, Violão, Cello, Vocal Masculino',
    recepcao_horas: '1', som: 'sim',
  });
});
test('ordinary WhatsApp conversation remains free and is not parsed as a form', () => {
  assert.equal(parseStructuredEventRequest('Oi, queria orçamento em Salvador para um casamento'), null);
  assert.equal(parseStructuredEventRequest('Consegue me dizer os preços?'), null);
});
test('explicit exclusion of professional sound is not misread as an add-on', () => {
  const form = FORM.replace('Incluir como serviço adicional no orçamento', 'Não incluir sonorização');
  assert.equal(parseStructuredEventRequest(form).som, 'não');
});
test('invalid dates and omitted optional information are never guessed', () => {
  const message = FORM.replace('14/03/2027','31/02/2027')
    .replace(/Experiência:.*\n/,'')
    .replace('SONORIZAÇÃO PROFISSIONAL:\nIncluir como serviço adicional no orçamento', '');
  const fields = parseStructuredEventRequest(message);
  assert.equal(fields.data_evento, undefined);
  assert.equal(fields.recepcao_horas, undefined);
  assert.equal(fields.som, undefined);
  assert.equal(fields.cidade, 'Cidade Sintética');
});
test('form with city and chosen formation gets quoted instead of another questionnaire', () => {
  assert.equal(resolveCommercialAction({ intent:'quote_request', action:'answer', facts:{} },
    { cidade:'Cidade Sintética', formacao:'Quarteto', _objetivo_comercial:'pricing' }), 'quote');
});
test('prompt prioritizes short initial collection without rigid scripts, prices stay official', () => {
  const system=buildSystemPrompt({settings:{assistant_name:'Nara'},companyName:'Harmonics',conversation:{lead_data:{}},isFirstAiReply:true});
  assert.match(system,/ATENDIMENTO DIRETO E HUMANO/);
  assert.match(system,/não copie modelos literalmente/);
  assert.match(system,/FORMULÁRIO DO SITE/);
  assert.match(system,/não envie mensagem de boas-vindas com formulário/);
  assert.match(system,/somente das ferramentas/i);
});
