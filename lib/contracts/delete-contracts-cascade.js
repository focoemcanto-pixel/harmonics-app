import { google } from 'googleapis';
import { loadGoogleCredentialsFromSupabase, validateGoogleCredentials } from '@/lib/contracts/googleCredentials';

function extractGoogleDriveFileId(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const patterns = [
    /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /[?&]id=([a-zA-Z0-9_-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

async function getDriveOrNull() {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
  if (!clientId || !clientSecret || !redirectUri) return null;

  try {
    const { credentials } = await loadGoogleCredentialsFromSupabase();
    const validation = validateGoogleCredentials(credentials);
    if (!validation.valid) return null;

    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    auth.setCredentials(validation.credentials);
    return google.drive({ version: 'v3', auth });
  } catch {
    return null;
  }
}

async function bestEffortDeleteDriveFile(drive, fileId) {
  if (!drive || !fileId) return;

  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (error) {
    const code = Number(error?.code || error?.response?.status || 0);
    if (code !== 404) {
      console.warn('[CONTRACT_DELETE_MANY][DRIVE_WARN]', { fileId, message: error?.message });
    }
  }
}

export async function deleteContractsCascade({ supabase, precontractIds = [] }) {
  const uniqueIds = Array.from(new Set(precontractIds.map((id) => String(id || '').trim()).filter(Boolean)));
  const success = [];
  const failed = [];
  const drive = await getDriveOrNull();

  for (const precontractId of uniqueIds) {
    try {
      const { data: precontract, error: preError } = await supabase
        .from('precontracts')
        .select('id')
        .eq('id', precontractId)
        .maybeSingle();
      if (preError) throw preError;
      if (!precontract?.id) {
        failed.push({ precontractId, error: 'Pré-contrato não encontrado.' });
        continue;
      }

      const { data: contracts, error: contractError } = await supabase
        .from('contracts')
        .select('id, doc_url, pdf_url')
        .eq('precontract_id', precontractId);
      if (contractError) throw contractError;

      for (const contract of contracts || []) {
        await bestEffortDeleteDriveFile(drive, extractGoogleDriveFileId(contract.doc_url));
        await bestEffortDeleteDriveFile(drive, extractGoogleDriveFileId(contract.pdf_url));
      }

      await supabase.from('contracts').delete().eq('precontract_id', precontractId);
      await supabase.from('precontracts').delete().eq('id', precontractId);

      success.push({ precontractId, deletedContracts: (contracts || []).length });
    } catch (error) {
      failed.push({ precontractId, error: error?.message || 'Erro ao excluir contrato.' });
    }
  }

  return { requested: uniqueIds.length, success, failed };
}
