import { CONTRACT_TAGS } from '@/lib/contracts/contractTagsRegistry';

const REQUIRED_GROUPS = {
  cliente: ['cliente_nome'],
  evento: ['evento_data', 'evento_local'],
  financeiro: ['valor_total'],
  operacao: ['formacao'],
  assinatura: ['assinatura_cliente'],
};

export const CONTRACT_READINESS_STATES = [
  {
    key: 'draft',
    label: 'Estrutura inicial',
    minScore: 0,
    color: 'slate',
    description: 'Seu contrato ainda está em construção.',
  },
  {
    key: 'operational',
    label: 'Operacional',
    minScore: 45,
    color: 'amber',
    description: 'O contrato já possui estrutura básica operacional.',
  },
  {
    key: 'automated',
    label: 'Automação pronta',
    minScore: 75,
    color: 'violet',
    description: 'O template já suporta automação comercial.',
  },
  {
    key: 'premium',
    label: 'Fluxo premium',
    minScore: 95,
    color: 'emerald',
    description: 'Seu template está altamente preparado para operação profissional.',
  },
];

function hasTag(foundTags = [], key) {
  return foundTags.includes(key);
}

function getReadinessState(score = 0) {
  return [...CONTRACT_READINESS_STATES]
    .reverse()
    .find((state) => score >= state.minScore) || CONTRACT_READINESS_STATES[0];
}

function buildMilestones(foundTags = []) {
  return [
    {
      key: 'client_identity',
      completed: REQUIRED_GROUPS.cliente.every((key) => hasTag(foundTags, key)),
      title: 'Cliente identificado',
      reward: 'Agora o contrato já consegue identificar o contratante.',
    },
    {
      key: 'event_structure',
      completed: REQUIRED_GROUPS.evento.every((key) => hasTag(foundTags, key)),
      title: 'Evento estruturado',
      reward: 'Seu contrato agora entende data e local do evento.',
    },
    {
      key: 'financial_flow',
      completed: REQUIRED_GROUPS.financeiro.every((key) => hasTag(foundTags, key)),
      title: 'Fluxo financeiro ativo',
      reward: 'Valores financeiros já podem ser automatizados.',
    },
    {
      key: 'operational_ready',
      completed: REQUIRED_GROUPS.operacao.every((key) => hasTag(foundTags, key)),
      title: 'Operação configurada',
      reward: 'A formação musical agora faz parte do contrato automático.',
    },
    {
      key: 'signature_ready',
      completed: REQUIRED_GROUPS.assinatura.every((key) => hasTag(foundTags, key)),
      title: 'Assinatura preparada',
      reward: 'Seu contrato já está pronto para aceite digital.',
    },
  ];
}

function buildSuggestions(foundTags = []) {
  const suggestions = [];

  Object.entries(REQUIRED_GROUPS).forEach(([group, keys]) => {
    const missing = keys.filter((key) => !hasTag(foundTags, key));

    if (!missing.length) return;

    missing.forEach((missingKey) => {
      const tag = CONTRACT_TAGS.find((item) => item.key === missingKey);
      if (!tag) return;

      suggestions.push({
        key: `missing_${missingKey}`,
        severity: 'medium',
        category: group,
        title: `Adicione ${tag.label}`,
        description: `Insira ${tag.tag} para completar esta parte do fluxo operacional.`,
        tag: tag.tag,
      });
    });
  });

  return suggestions;
}

export function buildContractExperience(analysis = {}) {
  const score = Number(analysis?.qualityScore || 0);
  const foundTags = Array.isArray(analysis?.foundTags) ? analysis.foundTags : [];

  const readiness = getReadinessState(score);
  const milestones = buildMilestones(foundTags);
  const suggestions = buildSuggestions(foundTags);

  const completedMilestones = milestones.filter((item) => item.completed).length;

  const nextMilestone = milestones.find((item) => !item.completed) || null;

  let celebration = null;

  if (score >= 95) {
    celebration = {
      type: 'premium_ready',
      title: 'Contrato premium concluído',
      description: 'Seu template está pronto para uma operação profissional avançada.',
    };
  } else if (score >= 75) {
    celebration = {
      type: 'automation_ready',
      title: 'Automação habilitada',
      description: 'Seu contrato já possui os principais elementos automáticos.',
    };
  } else if (score >= 45) {
    celebration = {
      type: 'operational_ready',
      title: 'Estrutura operacional criada',
      description: 'Seu contrato começou a ganhar inteligência operacional.',
    };
  }

  return {
    readiness,
    milestones,
    completedMilestones,
    nextMilestone,
    suggestions,
    celebration,
  };
}
