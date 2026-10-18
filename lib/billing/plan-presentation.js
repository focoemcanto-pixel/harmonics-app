// Textos de apresentação dos planos nas páginas públicas. Preços e limites vêm sempre de
// workspace_plans (mesma fonte do backend); aqui só fica o posicionamento de cada plano.

const TAGLINES = {
  free: 'Para conhecer o Harmonics e organizar os primeiros eventos.',
  starter: 'Para bandas que querem automatizar a rotina com WhatsApp.',
  pro: 'Para operações com agenda cheia e equipe maior.',
  enterprise: 'Sem limites de eventos, equipe ou mensagens.',
  white_label: 'Sem limites e com a sua marca no lugar da Harmonics.',
};

export const RECOMMENDED_PLAN_SLUG = 'starter';

export function planTagline(plan) {
  return plan?.description || TAGLINES[plan?.slug] || '';
}

export function formatMoney(value) {
  const number = Number(value || 0);
  const digits = Number.isInteger(number) ? 0 : 2;
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function isPaidPlan(plan) {
  return Number(plan?.monthly_price) > 0;
}

function limit(value, singular, plural) {
  if (value === null || value === undefined) return { text: `${plural.charAt(0).toUpperCase()}${plural.slice(1)} ilimitados`, unlimited: true };
  return { text: `${value} ${Number(value) === 1 ? singular : plural}` };
}

// Lista de itens do cartão do plano: limites + recursos incluídos/não incluídos.
export function planFeatureList(plan) {
  const items = [
    { ...limit(plan.max_events_per_month, 'evento por mês', 'eventos por mês'), included: true },
    { ...limit(plan.max_members, 'membro na equipe', 'membros na equipe'), included: true },
    { text: 'Contratos com assinatura online', included: Boolean(plan.can_use_contracts) },
    { text: 'Automações e lembretes', included: Boolean(plan.can_use_automation) },
    {
      text: plan.can_use_whatsapp
        ? plan.max_whatsapp_messages
          ? `WhatsApp integrado · ${plan.max_whatsapp_messages.toLocaleString('pt-BR')} mensagens/mês`
          : 'WhatsApp integrado · mensagens ilimitadas'
        : 'WhatsApp integrado',
      included: Boolean(plan.can_use_whatsapp),
    },
  ];
  if (plan.can_use_white_label) items.push({ text: 'Sua marca no lugar da Harmonics', included: true });
  return items;
}

// Linhas da tabela comparativa (mesmos campos que o backend usa para limitar).
export const COMPARISON_ROWS = [
  { label: 'Eventos por mês', value: (plan) => (plan.max_events_per_month ?? 'Ilimitados') },
  { label: 'Membros na equipe', value: (plan) => (plan.max_members ?? 'Ilimitados') },
  { label: 'Contratos com assinatura online', value: (plan) => Boolean(plan.can_use_contracts) },
  { label: 'Automações e lembretes', value: (plan) => Boolean(plan.can_use_automation) },
  {
    label: 'WhatsApp integrado',
    value: (plan) => (plan.can_use_whatsapp ? (plan.max_whatsapp_messages ? `${plan.max_whatsapp_messages.toLocaleString('pt-BR')} msg/mês` : 'Ilimitado') : false),
  },
  { label: 'Sua marca no lugar da Harmonics', value: (plan) => Boolean(plan.can_use_white_label) },
];
