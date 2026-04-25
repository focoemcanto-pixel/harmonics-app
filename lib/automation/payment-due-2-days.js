import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-whatsapp-message';

export const PAYMENT_DUE_2_DAYS_SOURCE = 'payment_due_2_days';
export const PAYMENT_DUE_2_DAYS_TEMPLATE_KEY = 'payment_due_2_days_client_whatsapp';
export const PAYMENT_DUE_2_DAYS_RULE_KEY = 'payment_due_2_days_rule';

export const DEFAULT_PAYMENT_DUE_2_DAYS_MESSAGE = `Está chegando diiaaa! Estamos muito ansiosos para esse grande dia. 💜

Passando para lembrar que o contrato precisa estar quitado até 2 dias antes do evento.

Se você ainda não realizou o pagamento, pedimos que realize para deixarmos tudo alinhado.

Se você já realizou, atualize seu status no app enviando o comprovante na aba Pagamentos.

Acesse aqui:
{{payment_link}}

Qualquer dúvida, estou por aqui.`;

function buildSaoPauloDate(offsetDays = 0) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const value = (type) => parts.find((p) => p.type === type)?.value || '00';
  const date = new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00-03:00`);
  date.setDate(date.getDate() + Number(offsetDays || 0));

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateBR(value) {
  if (!value) return '';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return String(value);
  return `${d}/${m}/${y}`;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function interpolateMessage(template, variables) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return String(variables?.[key] ?? '');
  });
}

async function ensureTemplate(supabase, workspaceId) {
  const { data: existing, error: selectError } = await supabase
    .from('message_templates')
    .select('id, key, name, body, is_active, recipient_type')
    .eq('workspace_id', workspaceId)
    .eq('key', PAYMENT_DUE_2_DAYS_TEMPLATE_KEY)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing?.id) {
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from('message_templates')
    .insert({
      workspace_id: workspaceId,
      key: PAYMENT_DUE_2_DAYS_TEMPLATE_KEY,
      name: 'Lembrete de quitação 2 dias antes',
      channel: 'whatsapp',
      recipient_type: 'client',
      body: DEFAULT_PAYMENT_DUE_2_DAYS_MESSAGE,
      is_active: true,
    })
    .select('id, key, name, body, is_active, recipient_type')
    .single();

  if (createError) throw createError;
  return created;
}

async function ensureRule(supabase, workspaceId, templateId) {
  const { data: existing, error: selectError } = await supabase
    .from('automation_rules')
    .select('id, key, name, is_active, template_id')
    .eq('workspace_id', workspaceId)
    .eq('key', PAYMENT_DUE_2_DAYS_RULE_KEY)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing?.id) {
    if (!existing.template_id && templateId) {
      const { data: updated, error: updateError } = await supabase
        .from('automation_rules')
        .update({ template_id: templateId })
        .eq('id', existing.id)
        .select('id, key, name, is_active, template_id')
        .single();
      if (!updateError) return updated;
    }
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from('automation_rules')
    .insert({
      workspace_id: workspaceId,
      key: PAYMENT_DUE_2_DAYS_RULE_KEY,
      name: 'Lembrete de quitação 2 dias antes',
      event_type: 'payment_pending_2_days_client',
      recipient_type: 'client',
      template_id: templateId,
      days_before: 2,
      send_time: '09:00',
      is_active: true,
    })
    .select('id, key, name, is_active, template_id')
    .single();

  if (createError) throw createError;
  return created;
}

export async function getPaymentDue2DaysConfig() {
  const supabase = getSupabaseAdmin();
  const workspace = await getDefaultWorkspaceSettings(supabase);

  const template = await ensureTemplate(supabase, workspace.id);
  const rule = await ensureRule(supabase, workspace.id, template.id);

  const isEnabled = rule?.is_active !== false;
  const message = template?.body || DEFAULT_PAYMENT_DUE_2_DAYS_MESSAGE;

  return {
    workspaceId: workspace.id,
    ruleId: rule?.id || null,
    templateId: template?.id || null,
    isEnabled,
    message,
  };
}

export async function updatePaymentDue2DaysConfig({ isEnabled, message }) {
  const supabase = getSupabaseAdmin();
  const config = await getPaymentDue2DaysConfig();

  const normalizedMessage =
    typeof message === 'string' && String(message).trim().length
      ? String(message)
      : DEFAULT_PAYMENT_DUE_2_DAYS_MESSAGE;

  const patch = {};
  if (typeof isEnabled === 'boolean') patch.is_active = isEnabled;

  if (Object.keys(patch).length && config.ruleId) {
    const { error: ruleError } = await supabase
      .from('automation_rules')
      .update(patch)
      .eq('id', config.ruleId);
    if (ruleError) throw ruleError;
  }

  if (config.templateId) {
    const { error: templateError } = await supabase
      .from('message_templates')
      .update({ body: normalizedMessage, recipient_type: 'client' })
      .eq('id', config.templateId);
    if (templateError) throw templateError;
  }

  return getPaymentDue2DaysConfig();
}

async function insertPaymentReminderLog({
  supabase,
  workspaceId,
  precontract,
  recipient,
  renderedMessage,
  paymentLink,
  status,
  errorMessage = null,
  providerResponse = null,
}) {
  const basePayload = {
    workspace_id: workspaceId,
    entity_id: precontract.id,
    entity_type: 'precontract',
    recipient_type: 'client',
    recipient: recipient,
    recipient_number: recipient,
    rendered_message: renderedMessage,
    metadata: {
      precontract_id: precontract.id,
      event_date: precontract.event_date,
      payment_link: paymentLink,
      trigger: '2_days_before_event',
    },
    provider_response: providerResponse,
    status,
    error_message: errorMessage,
    source: PAYMENT_DUE_2_DAYS_SOURCE,
    precontract_id: precontract.id,
  };

  let { error } = await supabase.from('automation_logs').insert(basePayload);

  if (error && String(error?.message || '').toLowerCase().includes('precontract_id')) {
    const fallback = { ...basePayload };
    delete fallback.precontract_id;
    const fallbackRes = await supabase.from('automation_logs').insert(fallback);
    error = fallbackRes.error;
  }

  if (error) {
    console.error('[payment_due_2_days] Falha ao criar automation_log', {
      precontractId: precontract.id,
      status,
      error: error.message,
    });
  }
}

async function fetchAlreadySentPrecontractIds(supabase, targetDate) {
  const baseQuery = supabase
    .from('automation_logs')
    .select('precontract_id, entity_id, metadata')
    .eq('source', PAYMENT_DUE_2_DAYS_SOURCE)
    .in('status', ['sent', 'success'])
    .gte('created_at', `${targetDate}T00:00:00-03:00`)
    .lte('created_at', `${targetDate}T23:59:59-03:00`);

  let data = null;
  let error = null;
  ({ data, error } = await baseQuery);

  if (error && String(error?.message || '').toLowerCase().includes('precontract_id')) {
    const fallbackRes = await supabase
      .from('automation_logs')
      .select('entity_id, metadata')
      .eq('source', PAYMENT_DUE_2_DAYS_SOURCE)
      .in('status', ['sent', 'success'])
      .gte('created_at', `${targetDate}T00:00:00-03:00`)
      .lte('created_at', `${targetDate}T23:59:59-03:00`);
    data = fallbackRes.data;
    error = fallbackRes.error;
  }

  if (error) {
    console.error('[payment_due_2_days] Erro ao buscar logs existentes:', error);
    return new Set();
  }

  return new Set(
    (data || [])
      .map((row) => row?.precontract_id || row?.entity_id || row?.metadata?.precontract_id)
      .filter(Boolean)
      .map(String)
  );
}

async function fetchPrecontractsDue(supabase, targetDate) {
  const { data, error } = await supabase
    .from('precontracts')
    .select('id, client_name, client_phone, public_token, event_date, event_time, status')
    .eq('event_date', targetDate)
    .not('status', 'in', '(cancelled)')
    .not('client_phone', 'is', null)
    .neq('client_phone', '')
    .not('public_token', 'is', null)
    .neq('public_token', '');

  if (error) throw error;
  return data || [];
}

export async function runPaymentDue2DaysReminder({ forcedTargetDate = null } = {}) {
  const supabase = getSupabaseAdmin();
  const workspace = await getDefaultWorkspaceSettings(supabase);
  const config = await getPaymentDue2DaysConfig();

  if (!config.isEnabled) {
    return {
      ok: true,
      skipped: true,
      reason: 'disabled',
      targetDate: forcedTargetDate || buildSaoPauloDate(2),
      sent: 0,
      failed: 0,
      skippedDuplicates: 0,
      totalCandidates: 0,
    };
  }

  const targetDate = forcedTargetDate || buildSaoPauloDate(2);
  const appUrl = String(
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://app.bandaharmonics.com'
  )
    .trim()
    .replace(/\/+$/, '');

  const precontracts = await fetchPrecontractsDue(supabase, targetDate);
  const alreadySent = await fetchAlreadySentPrecontractIds(supabase, targetDate);

  let sent = 0;
  let failed = 0;
  let skippedDuplicates = 0;

  for (const precontract of precontracts) {
    const precontractId = String(precontract.id);
    if (alreadySent.has(precontractId)) {
      skippedDuplicates += 1;
      continue;
    }

    const recipient = normalizePhone(precontract.client_phone);
    if (!recipient || !precontract.public_token) {
      continue;
    }

    const paymentLink = `${appUrl}/cliente/${precontract.public_token}?tab=pagamentos`;
    const renderedMessage = interpolateMessage(config.message, {
      client_name: precontract.client_name || 'Cliente',
      event_date: formatDateBR(precontract.event_date),
      event_time: String(precontract.event_time || '').slice(0, 5),
      payment_link: paymentLink,
    });

    try {
      const providerResponse = await sendWhatsAppMessage({
        to: recipient,
        message: renderedMessage,
      });

      sent += 1;
      await insertPaymentReminderLog({
        supabase,
        workspaceId: workspace.id,
        precontract,
        recipient,
        renderedMessage,
        paymentLink,
        status: 'sent',
        providerResponse,
      });
    } catch (error) {
      failed += 1;
      await insertPaymentReminderLog({
        supabase,
        workspaceId: workspace.id,
        precontract,
        recipient,
        renderedMessage,
        paymentLink,
        status: 'failed',
        errorMessage: error?.message || 'Falha no envio do WhatsApp',
        providerResponse: {
          provider: error?.provider || null,
          status: error?.providerStatus || null,
          response: error?.providerResponse || null,
        },
      });
    }
  }

  return {
    ok: true,
    targetDate,
    totalCandidates: precontracts.length,
    sent,
    failed,
    skippedDuplicates,
  };
}
