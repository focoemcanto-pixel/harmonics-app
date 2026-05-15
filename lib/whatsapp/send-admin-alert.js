import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { getChannel } from '@/lib/automation/get-channel';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-whatsapp-message';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function normalizePhone(value) {
  const phone = String(value || '').trim();
  return phone || '';
}

function normalizeWorkspaceId(value) {
  const workspaceId = String(value || '').trim();
  return workspaceId || null;
}

function resolveRealWorkspaceId(workspace) {
  return String(workspace?.workspace_id || workspace?.workspaceId || workspace?.id || '').trim() || null;
}

async function resolveWorkspaceAdminPhone(workspaceId) {
  const scopedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (!scopedWorkspaceId) return '';

  const supabase = getSupabaseAdmin();

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, admin_whatsapp_phone')
    .eq('id', scopedWorkspaceId)
    .maybeSingle();

  if (workspaceError) {
    console.warn('[ADMIN_ALERT] Falha ao buscar telefone admin do workspace:', {
      workspaceId: scopedWorkspaceId,
      message: workspaceError?.message,
    });
  }

  const workspaceAdminPhone = normalizePhone(workspace?.admin_whatsapp_phone);
  if (workspaceAdminPhone) return workspaceAdminPhone;

  const channel = await getChannel(scopedWorkspaceId);
  const channelNumber = normalizePhone(channel?.admin_alert_number);
  if (channelNumber) return channelNumber;

  return '';
}

export async function resolveAdminAlertNumber({ workspaceId } = {}) {
  const scopedWorkspaceId = normalizeWorkspaceId(workspaceId);

  if (scopedWorkspaceId) {
    const scopedNumber = await resolveWorkspaceAdminPhone(scopedWorkspaceId);
    if (scopedNumber) return scopedNumber;

    console.warn('[ADMIN_ALERT] número do admin não configurado para workspace; nenhum fallback global será usado para evitar vazamento cross-workspace.', {
      workspaceId: scopedWorkspaceId,
    });

    return '';
  }

  const workspace = await getDefaultWorkspaceSettings();
  const workspaceAdminPhone = normalizePhone(workspace?.admin_whatsapp_phone);
  if (workspaceAdminPhone) return workspaceAdminPhone;

  // Compatibilidade legado: usado apenas quando chamada antiga não informa workspaceId.
  const realWorkspaceId = resolveRealWorkspaceId(workspace);
  const channel = await getChannel(realWorkspaceId);
  const channelNumber = normalizePhone(channel?.admin_alert_number);
  if (channelNumber) return channelNumber;

  const envPhone = normalizePhone(process.env.ADMIN_WHATSAPP_PHONE || process.env.WHATSAPP_ADMIN_ALERT_NUMBER);
  if (!envPhone) {
    console.error('[ADMIN_ALERT] número do admin não configurado (workspace_settings/admin_whatsapp_phone, canal padrão/admin_alert_number nem ADMIN_WHATSAPP_PHONE).', {
      workspace_settings_id: workspace?.id || null,
      workspace_id: realWorkspaceId,
    });
  }
  return envPhone;
}

export async function sendAdminWhatsAppAlert(message, options = {}) {
  const adminNumber = await resolveAdminAlertNumber({ workspaceId: options?.workspaceId });

  if (!adminNumber) {
    return {
      ok: false,
      skipped: true,
      reason: options?.workspaceId
        ? 'workspace_admin_alert_number_not_configured'
        : 'admin_alert_number_not_configured',
    };
  }

  const providerResponse = await sendWhatsAppMessage({
    to: adminNumber,
    message,
  });

  return {
    ok: true,
    skipped: false,
    to: adminNumber,
    workspaceId: options?.workspaceId || null,
    providerResponse,
  };
}
