import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { getChannel } from '@/lib/automation/get-channel';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-whatsapp-message';

function normalizePhone(value) {
  const phone = String(value || '').trim();
  return phone || '';
}

function resolveRealWorkspaceId(workspace) {
  return String(workspace?.workspace_id || workspace?.workspaceId || workspace?.id || '').trim() || null;
}

export async function resolveAdminAlertNumber() {
  const workspace = await getDefaultWorkspaceSettings();
  const workspaceAdminPhone = normalizePhone(workspace?.admin_whatsapp_phone);
  if (workspaceAdminPhone) return workspaceAdminPhone;

  // Após a normalização multi-workspace, whatsapp_channels.workspace_id aponta para workspaces.id.
  // Já workspace.id aqui é o id de workspace_settings em vários fluxos legados.
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

export async function sendAdminWhatsAppAlert(message) {
  const adminNumber = await resolveAdminAlertNumber();

  if (!adminNumber) {
    return {
      ok: false,
      skipped: true,
      reason: 'admin_alert_number_not_configured',
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
    providerResponse,
  };
}
