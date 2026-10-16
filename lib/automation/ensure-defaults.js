import { getSupabaseAdmin } from '../supabase-admin';

const DEFAULT_AUTOMATIONS = [
  {
    template: {
      key: 'invite_member_whatsapp',
      name: 'Convite de escala para membro',
      channel: 'whatsapp',
      recipient_type: 'member',
      body: `Olá, {nome_membro}! 🎶

Você recebeu um convite para participar do evento {evento_nome}.

📅 Data: {evento_data}
🕒 Horário: {evento_horario}
📍 Local: {evento_local}

Acesse seu painel para confirmar ou recusar o convite:
{link_painel_membro}`,
    },
    rule: {
      key: 'invite_member_auto',
      name: 'Convite automático para membro',
      event_type: 'invite_member',
      recipient_type: 'member',
      is_active: true,
    },
  },
  {
    template: {
      key: 'invite_member_reminder_whatsapp',
      name: 'Lembrete de convite sem resposta',
      channel: 'whatsapp',
      recipient_type: 'member',
      body: `Olá, {nome_membro}! 🎶

Seu convite para o evento {evento_nome} ainda está aguardando sua resposta.

📅 Data: {evento_data}
🕒 Horário: {evento_horario}
📍 Local: {evento_local}

Acesse seu painel para confirmar ou recusar:
{link_painel_membro}`,
    },
    rule: {
      // Mesma key do preset "Lembrete de não resposta" da Central de Automação.
      key: 'lembrete_nao_resposta_rapido',
      name: 'Lembrete de não resposta',
      event_type: 'schedule_no_response_member',
      recipient_type: 'member',
      // Dias contados do envio do convite inicial (não da data do evento).
      days_after: 5,
      send_time: '09:00',
      is_active: true,
    },
  },
  {
    template: {
      key: 'contract_signed_admin_whatsapp',
      name: 'Admin — contrato assinado',
      channel: 'whatsapp',
      recipient_type: 'admin',
      body: `✅ Contrato assinado
Cliente: {cliente_nome}
Evento: {evento_data} às {evento_horario}
Link do contrato/PDF: {pdf_url}
Painel: {link_painel_cliente}`,
    },
    rule: {
      key: 'contract_signed_admin_auto',
      name: 'Admin — contrato assinado',
      event_type: 'contract_signed_admin',
      recipient_type: 'admin',
      is_active: true,
    },
  },
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

// Defaults só CRIAM o que falta. Template ou regra existente nunca é alterado aqui:
// estado (is_active), texto, template vinculado, dias e horário configurados pelo
// admin são preservados. Antes, o upsert gravava is_active=true a cada execução de
// automação e reativou invite_member_auto, causando convites de escala duplicados.
async function ensureRow(supabase, table, workspaceId, row) {
  const { data: existing, error: readError } = await supabase
    .from(table)
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('key', row.key)
    .maybeSingle();
  if (readError) throw readError;
  if (existing?.id) return { id: existing.id, created: false };

  const { data: inserted, error: insertError } = await supabase
    .from(table)
    .insert({ workspace_id: workspaceId, ...row })
    .select('id')
    .single();
  if (!insertError && inserted?.id) return { id: inserted.id, created: true };

  // Corrida com outra execução criando o mesmo default: usa o registro que venceu.
  if (insertError?.code === '23505') {
    const { data: winner } = await supabase
      .from(table)
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('key', row.key)
      .maybeSingle();
    if (winner?.id) return { id: winner.id, created: false };
  }
  throw insertError || new Error(`Falha ao criar default ${table}.${row.key}`);
}

export async function ensureDefaultAutomations(workspaceId, { supabase = getSupabaseAdmin() } = {}) {
  if (!workspaceId) return;

  for (const item of DEFAULT_AUTOMATIONS) {
    try {
      const template = await ensureRow(supabase, 'message_templates', workspaceId, {
        ...item.template,
        is_active: true,
      });
      await ensureRow(supabase, 'automation_rules', workspaceId, {
        ...item.rule,
        template_id: template.id,
      });
    } catch (error) {
      console.error('[ensureDefaultAutomations] falha ao garantir default', {
        workspaceId,
        rule: item.rule.key,
        error: error?.message || String(error),
      });
    }
  }
}

export const DEFAULT_AUTOMATION_RULE_KEYS = DEFAULT_AUTOMATIONS.map((item) => item.rule.key);
