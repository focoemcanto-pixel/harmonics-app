export const CONTRACT_TAG_CATEGORIES = [
  {
    key: 'cliente',
    label: 'Cliente',
    description: 'Dados de quem está contratando o serviço.',
  },
  {
    key: 'evento',
    label: 'Evento',
    description: 'Informações principais da cerimônia, festa ou apresentação.',
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    description: 'Valores, sinal, saldo e condições de pagamento.',
  },
  {
    key: 'operacao',
    label: 'Operação',
    description: 'Formação, músicos, som, repertório e observações técnicas.',
  },
  {
    key: 'assinatura',
    label: 'Assinatura',
    description: 'Campos de assinatura e aceite do cliente.',
  },
];

export const CONTRACT_TAGS = [
  {
    key: 'cliente_nome',
    tag: '{{cliente_nome}}',
    label: 'Nome do cliente',
    category: 'cliente',
    description: 'Nome completo do contratante ou responsável pelo evento.',
    example: 'João e Maria',
    required: true,
  },
  {
    key: 'cliente_email',
    tag: '{{cliente_email}}',
    label: 'E-mail do cliente',
    category: 'cliente',
    description: 'E-mail informado pelo cliente no preenchimento do contrato.',
    example: 'cliente@email.com',
    required: false,
  },
  {
    key: 'cliente_telefone',
    tag: '{{cliente_telefone}}',
    label: 'Telefone do cliente',
    category: 'cliente',
    description: 'WhatsApp ou telefone principal do contratante.',
    example: '(71) 99999-9999',
    required: false,
  },
  {
    key: 'evento_tipo',
    tag: '{{evento_tipo}}',
    label: 'Tipo do evento',
    category: 'evento',
    description: 'Categoria comercial do evento, como casamento, aniversário ou corporativo.',
    example: 'Casamento',
    required: true,
  },
  {
    key: 'evento_data',
    tag: '{{evento_data}}',
    label: 'Data do evento',
    category: 'evento',
    description: 'Data principal em que o evento acontecerá.',
    example: '20/12/2026',
    required: true,
  },
  {
    key: 'evento_horario',
    tag: '{{evento_horario}}',
    label: 'Horário do evento',
    category: 'evento',
    description: 'Horário previsto de início do serviço.',
    example: '16:30',
    required: true,
  },
  {
    key: 'evento_local',
    tag: '{{evento_local}}',
    label: 'Local do evento',
    category: 'evento',
    description: 'Nome do espaço, igreja, salão ou endereço do evento.',
    example: 'Igreja São Francisco',
    required: true,
  },
  {
    key: 'evento_endereco',
    tag: '{{evento_endereco}}',
    label: 'Endereço do evento',
    category: 'evento',
    description: 'Endereço completo onde o serviço será realizado.',
    example: 'Av. Paralela, Salvador - BA',
    required: false,
  },
  {
    key: 'valor_total',
    tag: '{{valor_total}}',
    label: 'Valor total',
    category: 'financeiro',
    description: 'Valor total acordado para o evento.',
    example: 'R$ 3.500,00',
    required: true,
  },
  {
    key: 'valor_sinal',
    tag: '{{valor_sinal}}',
    label: 'Valor do sinal',
    category: 'financeiro',
    description: 'Valor pago ou previsto como entrada/sinal.',
    example: 'R$ 1.750,00',
    required: true,
  },
  {
    key: 'valor_saldo',
    tag: '{{valor_saldo}}',
    label: 'Valor do saldo',
    category: 'financeiro',
    description: 'Valor restante a ser pago antes do evento.',
    example: 'R$ 1.750,00',
    required: true,
  },
  {
    key: 'data_vencimento_saldo',
    tag: '{{data_vencimento_saldo}}',
    label: 'Vencimento do saldo',
    category: 'financeiro',
    description: 'Prazo final para pagamento do saldo.',
    example: '18/12/2026',
    required: false,
  },
  {
    key: 'formacao',
    tag: '{{formacao}}',
    label: 'Formação musical',
    category: 'operacao',
    description: 'Formação contratada, como solo, duo, trio ou quarteto.',
    example: 'Quarteto com voz, teclado, violino e sax',
    required: true,
  },
  {
    key: 'instrumentos',
    tag: '{{instrumentos}}',
    label: 'Instrumentos',
    category: 'operacao',
    description: 'Lista de instrumentos ou funções envolvidas no serviço.',
    example: 'Voz, teclado, violino e saxofone',
    required: false,
  },
  {
    key: 'observacoes',
    tag: '{{observacoes}}',
    label: 'Observações',
    category: 'operacao',
    description: 'Observações especiais combinadas com o cliente.',
    example: 'Entrada da noiva com música específica',
    required: false,
  },
  {
    key: 'assinatura_cliente',
    tag: '{{assinatura_cliente}}',
    label: 'Assinatura do cliente',
    category: 'assinatura',
    description: 'Campo reservado para assinatura ou aceite digital do cliente.',
    example: 'Assinatura digital do contratante',
    required: true,
  },
  {
    key: 'data_assinatura',
    tag: '{{data_assinatura}}',
    label: 'Data da assinatura',
    category: 'assinatura',
    description: 'Data em que o contrato foi aceito ou assinado.',
    example: '13/05/2026',
    required: false,
  },
];

export function getContractTagByKey(key) {
  const normalized = String(key || '').trim();
  return CONTRACT_TAGS.find((tag) => tag.key === normalized) || null;
}

export function getContractTagsByCategory(categoryKey) {
  const normalized = String(categoryKey || '').trim();
  return CONTRACT_TAGS.filter((tag) => tag.category === normalized);
}

export function getRequiredContractTags() {
  return CONTRACT_TAGS.filter((tag) => tag.required === true);
}

export function getMockContractTagValues() {
  return Object.fromEntries(CONTRACT_TAGS.map((tag) => [tag.tag, tag.example]));
}
