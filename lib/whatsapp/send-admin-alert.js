import { getDefaultWorkspace } from '@/lib/automation/get-workspace';
import { getChannel } from '@/lib/automation/get-channel';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-whatsapp-message';

function normalizePhone(value) {
  const phone = String(value || '').trim();
  return phone || '';
}

export async function resolveAdminAlertNumber() {
  const workspaceId = await getDefaultWorkspace();
  if (!workspaceId) return normalizePhone(process.env.WHATSAPP_ADMIN_ALERT_NUMBER);

  const channel = await getChannel(workspaceId);
  const channelNumber = normalizePhone(channel?.admin_alert_number);
  if (channelNumber) return channelNumber;

  return normalizePhone(process.env.WHATSAPP_ADMIN_ALERT_NUMBER);
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
