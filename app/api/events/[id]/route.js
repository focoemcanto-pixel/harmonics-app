import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  loadGoogleCredentialsFromSupabase,
  validateGoogleCredentials,
} from '@/lib/contracts/googleCredentials';
import { extractBucketAndPathFromProofUrl } from '@/lib/payments/payment-proof-storage';

const EVENT_DELETE_CHILDREN = [
  { table: 'contract_adjustment_requests', column: 'event_id', label: 'solicitações contratuais' },
  { table: 'automation_logs', column: 'event_id', label: 'logs de automação' },
  { table: 'invites', column: 'event_id', label: 'convites' },
  { table: 'event_musicians', column: 'event_id', label: 'músicos da escala' },
  { table: 'repertoire_items', column: 'event_id', label: 'itens de repertório' },
  { table: 'repertoire_tokens', column: 'event_id', label: 'tokens de repertório' },
  { table: 'repertoire_config', column: 'event_id', label: 'configuração de repertório' },
  { table: 'payments', column: 'event_id', label: 'pagamentos' },
  { table: 'contracts', column: 'event_id', label: 'contratos' },
  { table: 'precontracts', column: 'event_id', label: 'pré-contratos' },
];

function normalizeUrl(value) {
  const url = String(value || '').trim();
  return url || '';
}

function extractGoogleDriveFileId(value) {
  const raw = normalizeUrl(value);
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

async function getGoogleDriveClientOrNull() {
  try {
    if (!google) return null;

    const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
    const redirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();

    if (!clientId || !clientSecret || !redirectUri) {
      console.warn('[EVENT_DELETE_API][GOOGLE_DRIVE_SKIP]', {
        reason: 'missing_google_envs',
      });
      return null;
    }

    const { credentials } = await loadGoogleCredentialsFromSupabase();
    const validation = validateGoogleCredentials(credentials);

    if (!validation.valid) {
      console.warn('[EVENT_DELETE_API][GOOGLE_DRIVE_SKIP]', {
        reason: validation.reason,
      });
      return null;
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    auth.setCredentials({
      refresh_token: validation.credentials.refresh_token,
      access_token: validation.credentials.access_token,
      token_type: validation.credentials.token_type || 'Bearer',
      expiry_date: validation.credentials.expiry_date,
    });

    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.warn('[EVENT_DELETE_API][GOOGLE_DRIVE_SKIP]', {
      reason: error?.message || 'unknown_google_auth_error',
    });
    return null;
  }
}

async function bestEffortDeleteDriveFile(drive, fileId, label) {
  if (!drive || !fileId) {
    return { ok: false, skipped: true, fileId: fileId || null, label };
  }

  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });

    return { ok: true, fileId, label };
  } catch (error) {
    const code = Number(error?.code || error?.response?.status || 0);
    if (code === 404) {
      return { ok: true, skipped: true, fileId, label, reason: 'already_missing' };
    }

    console.warn('[EVENT_DELETE_API][GOOGLE_DRIVE_DELETE_WARN]', {
      fileId,
      label,
      message: error?.message,
      code: error?.code,
    });

    return {
      ok: false,
      fileId,
      label,
      error: error?.message || 'google_drive_delete_failed',
    };
  }
}

async function bestEffortDeleteProofFiles(supabase, payments) {
  const results = [];

  for (const payment of payments || []) {
    const { bucket, path } = extractBucketAndPathFromProofUrl(payment?.proof_file_url);
    if (!bucket || !path) {
      if (payment?.proof_file_url) {
        results.push({
          ok: false,
          skipped: true,
          paymentId: payment.id,
          reason: 'invalid_proof_url',
        });
      }
      continue;
    }

    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) {
        console.warn('[EVENT_DELETE_API][PROOF_DELETE_WARN]', {
          paymentId: payment.id,
          bucket,
          path,
          message: error.message,
        });
        results.push({
          ok: false,
          paymentId: payment.id,
          bucket,
          path,
          error: error.message,
        });
      } else {
        results.push({
          ok: true,
          paymentId: payment.id,
          bucket,
          path,
        });
      }
    } catch (error) {
      console.warn('[EVENT_DELETE_API][PROOF_DELETE_WARN]', {
        paymentId: payment.id,
        bucket,
        path,
        message: error?.message,
      });
      results.push({
        ok: false,
        paymentId: payment.id,
        bucket,
        path,
        error: error?.message || 'proof_delete_failed',
      });
    }
  }

  return results;
}

async function deleteRowsByEventId(supabase, eventId, config) {
  const { data, error } = await supabase
    .from(config.table)
    .delete()
    .eq(config.column, eventId)
    .select('id');

  if (error) {
    throw new Error(`${config.label}: ${error.message}`);
  }

  return {
    table: config.table,
    label: config.label,
    count: Array.isArray(data) ? data.length : 0,
  };
}

export async function DELETE(_request, { params }) {
  const supabase = getSupabaseAdmin();
  const routeParams = await params;
  const eventId = String(routeParams?.id || '').trim();

  console.info('[EVENT_DELETE_API][INPUT]', { eventId });

  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: 'ID do evento é obrigatório.' },
      { status: 400 }
    );
  }

  try {
    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id, client_name')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) throw eventError;

    if (!eventRow?.id) {
      return NextResponse.json(
        { ok: false, error: 'Evento não encontrado para exclusão.' },
        { status: 404 }
      );
    }

    const { data: contractRows, error: contractsError } = await supabase
      .from('contracts')
      .select('id, doc_url, pdf_url')
      .eq('event_id', eventId);

    if (contractsError) throw contractsError;

    const { data: paymentRows, error: paymentsError } = await supabase
      .from('payments')
      .select('id, proof_file_url')
      .eq('event_id', eventId);

    if (paymentsError) throw paymentsError;

    const drive = await getGoogleDriveClientOrNull();
    const proofCleanup = await bestEffortDeleteProofFiles(supabase, paymentRows || []);

    const driveCleanup = [];
    for (const contract of contractRows || []) {
      const docId = extractGoogleDriveFileId(contract?.doc_url);
      const pdfId = extractGoogleDriveFileId(contract?.pdf_url);
      if (docId) {
        driveCleanup.push(await bestEffortDeleteDriveFile(drive, docId, 'google_doc'));
      }
      if (pdfId) {
        driveCleanup.push(await bestEffortDeleteDriveFile(drive, pdfId, 'google_pdf'));
      }
    }

    const deletedDependencies = [];
    for (const dependency of EVENT_DELETE_CHILDREN) {
      deletedDependencies.push(await deleteRowsByEventId(supabase, eventId, dependency));
    }

    const { data: deletedEvent, error: deleteEventError } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .select('id')
      .maybeSingle();

    if (deleteEventError) throw deleteEventError;

    if (!deletedEvent?.id) {
      return NextResponse.json(
        { ok: false, error: 'Evento não encontrado para exclusão.' },
        { status: 404 }
      );
    }

    const cleanupSummary = {
      deletedDependencies,
      proofCleanup,
      driveCleanup,
    };

    console.info('[EVENT_DELETE_API][CASCADE_DELETE_SUCCESS]', {
      eventId,
      eventName: eventRow.client_name || null,
      cleanupSummary,
    });

    return NextResponse.json({
      ok: true,
      deletedId: deletedEvent.id,
      cleanup: cleanupSummary,
    });
  } catch (error) {
    console.error('[EVENT_DELETE_API][ERROR]', {
      eventId,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Erro inesperado ao excluir evento no servidor.',
      },
      { status: 500 }
    );
  }
}
