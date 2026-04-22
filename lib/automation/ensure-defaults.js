import { getSupabaseAdmin } from '../supabase-admin';

const DEFAULT_AUTOMATIONS = [
  {
    template: {
      key: 'contract_review_released_client_whatsapp',
      name: 'Revisão de contrato liberada',
      channel: 'whatsapp',
      recipient_type: 'client',
      body: `Oi, {cliente_nome}! 💜

Seu pedido de revisão do contrato foi concluído e já liberamos novamente para você revisar/seguir com o processo.
Você pode acessar por aqui: {link_contrato}
Qualquer dúvida, seguimos à disposição.`,
    },
    rule: {
      key: 'contract_review_released_client_auto',
      name: 'Revisão de contrato liberada',
      event_type: 'contract_review_released_client',
      recipient_type: 'client',
      is_active: true,
    },
  },
  {
    template: {
      key: 'repertoire_review_released_client_whatsapp',
      name: 'Revisão de repertório liberada',
      channel: 'whatsapp',
      recipient_type: 'client',
      body: `Oi, {cliente_nome}! 💜

Seu pedido de revisão do repertório foi aceito e já liberamos a edição novamente para você.
Você pode acessar seu painel por aqui: {client_panel_link}
Se precisar, seguimos por aqui.`,
    },
    rule: {
      key: 'repertoire_review_released_client_auto',
      name: 'Revisão de repertório liberada',
      event_type: 'repertoire_review_released_client',
      recipient_type: 'client',
      is_active: true,
    },
  },
  {
    template: {
      key: 'event_day_confirmation_client_whatsapp',
      name: 'Confirmação no dia do evento',
      channel: 'whatsapp',
      recipient_type: 'client',
      body: `Oi, {cliente_nome}! 💜

É hoje o grande dia, e estamos muito felizes pela confiança em fazer parte desse momento tão especial.

Só queremos confirmar com você se o horário previsto para o início da cerimônia continua sendo às {event_time}.
Nossa equipe se organiza para chegar com 2 horas de antecedência, e lembramos que atrasos superiores a 1 hora podem gerar multa contratual.

Se puder, nos confirme por aqui se esse continua sendo o horário previsto.
Muito obrigado e desejamos que seja um dia lindo e abençoado! ✨`,
    },
    rule: {
      key: 'event_day_confirmation_client_auto',
      name: 'Confirmação no dia do evento',
      event_type: 'event_day_confirmation_client',
      recipient_type: 'client',
      is_active: true,
    },
  },
];

export async function ensureDefaultAutomations(workspaceId) {
  if (!workspaceId) return;
  const supabase = getSupabaseAdmin();

  for (const item of DEFAULT_AUTOMATIONS) {
    const { data: template } = await supabase
      .from('message_templates')
      .upsert(
        {
          workspace_id: workspaceId,
          ...item.template,
          is_active: true,
        },
        { onConflict: 'workspace_id,key' }
      )
      .select('id')
      .single();

    if (!template?.id) continue;

    await supabase.from('automation_rules').upsert(
      {
        workspace_id: workspaceId,
        ...item.rule,
        template_id: template.id,
      },
      { onConflict: 'workspace_id,key' }
    );
  }
}
