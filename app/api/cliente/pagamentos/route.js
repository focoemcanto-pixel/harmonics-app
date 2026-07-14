import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAdminWhatsAppAlert } from '@/lib/whatsapp/send-admin-alert';
import {
  buildWorkspacePaymentProofPath,
  resolvePaymentProofBucketName,
} from '@/lib/payments/payment-proof-storage';

const MAX_PROOF_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROOF_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.');
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function parseAmount(value) {
  const normalized = String(value ?? '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatDateBR(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function normalizeMethodLabel(value) {
  if (!value) return null;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function resolveAppBaseUrl(request) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.APP_URL || '';
  if (configured) return configured.replace(/\/$/, '');

  const origin = request?.nextUrl?.origin || '';
  return origin.replace(/\/$/, '');
}

function sanitizeExtension(value) {
  const extension = String(value || 'bin')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);

  return extension || 'bin';
}

function validateProofFile(file) {
  if (!file) return;

  if (file.size > MAX_PROOF_FILE_SIZE_BYTES) {
    throw new Error('O comprovante deve ter no máximo 10MB.');
  }

  if (file.type && !ALLOWED_PROOF_MIME_TYPES.has(file.type)) {
    throw new Error('Formato de comprovante não permitido. Envie PDF, JPG, PNG ou WEBP.');
  }
}

async function readRequestPayload(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    return {
      token: normalizeText(formData.get('token')),
      amount: parseAmount(formData.get('amount')),
      paymentDate: normalizeText(formData.get('paymentDate')),
      notes: normalizeText(formData.get('notes')),
      paymentMethod: normalizeText(formData.get('paymentMethod')) || 'pix',
      proofFile: formData.get('proofFile'),
      proofFileName: normalizeText(formData.get('proofFileName')),
    };
  }

  const body = await request.json();
  return {
    token: normalizeText(body?.token),
    amount: parseAmount(body?.amount),
    paymentDate: normalizeText(body?.paymentDate),
    notes: normalizeText(body?.notes),
    paymentMethod: normalizeText(body?.paymentMethod) || 'pix',
    proofFile: null,
    proofFileName: normalizeText(body?.proofFileName),
  };
}

export async function POST(request) {
  try {
    const supabase = getAdminSupabase();
    const payload = await readRequestPayload(request);
    const { token, amount, paymentDate, notes, paymentMethod } = payload;
    const proofFile = payload.proofFile instanceof File ? payload.proofFile : null;
    const proofFileName = normalizeText(proofFile?.name || payload.proofFileName);

    console.log('[PAYMENT_PROOF][UPLOAD_INPUT]', {
      hasToken: Boolean(token),
      amount,
      paymentDate,
      paymentMethod,
      proofFileName,
      proofFileSize: proofFile?.size || 0,
      proofFileType: proofFile?.type || null,
    });

    if (!token || !amount || !paymentDate) {
      return NextResponse.json(
        { ok: false, error: 'Campos obrigatórios: token, amount, paymentDate.' },
        { status: 400 }
      );
    }

    validateProofFile(proofFile);

    const { data: precontract, error: precontractError } = await supabase
      .from('precontracts')
      .select('event_id, public_token, workspace_id')
      .eq('public_token', token)
      .maybeSingle();

    if (precontractError) throw precontractError;

    let contract = null;
    if (!precontract?.event_id) {
      const { data: contractRow, error: contractError } = await supabase
        .from('contracts')
        .select('event_id, public_token')
        .eq('public_token', token)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contractError) throw contractError;
      contract = contractRow || null;
    }

    const eventId = precontract?.event_id || contract?.event_id || null;
    const tokenResolution = precontract?.event_id
      ? 'precontract_token'
      : contract?.event_id
        ? 'contract_token'
        : 'none';

    if (!eventId) {
      return NextResponse.json({ ok: false, error: 'Token inválido.' }, { status: 404 });
    }

    console.log('[PAYMENT_PROOF][TOKEN_RESOLVED]', {
      eventId,
      tokenResolution,
    });

    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id, workspace_id, client_name, event_date, agreed_amount, paid_amount, open_amount, location_name')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!eventRow) {
      return NextResponse.json({ ok: false, error: 'Evento não encontrado.' }, { status: 404 });
    }

    const workspaceId = String(eventRow.workspace_id || precontract?.workspace_id || '').trim();

    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: 'Workspace do evento não encontrado.' },
        { status: 500 }
      );
    }

    if (precontract?.workspace_id && String(precontract.workspace_id) !== workspaceId) {
      return NextResponse.json(
        { ok: false, error: 'Token incompatível com o workspace do evento.' },
        { status: 409 }
      );
    }

    const currentPaidAmount = Number(eventRow.paid_amount || 0);
    const totalAmount = Number(eventRow.agreed_amount || 0);
    const nextPaidAmount = currentPaidAmount + amount;
    const nextOpenAmount = Math.max(totalAmount - nextPaidAmount, 0);
    const paymentStatus = nextOpenAmount <= 0 && totalAmount > 0 ? 'Pago' : 'Parcial';

    let proofFileUrl = null;
    if (proofFile) {
      const bucketName = resolvePaymentProofBucketName();
      const extension = sanitizeExtension(proofFile.name?.split('.').pop() || 'bin');
      const objectPath = buildWorkspacePaymentProofPath({
        workspaceId,
        eventId,
        fileName: `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`,
      });
      const arrayBuffer = await proofFile.arrayBuffer();

      console.log('[PAYMENT_PROOF][UPLOAD_BUCKET]', bucketName);
      console.log('[PAYMENT_PROOF][UPLOAD_PATH]', objectPath);

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(objectPath, arrayBuffer, {
          contentType: proofFile.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Segurança multi-tenant: armazenar apenas o path interno.
      // A abertura deve passar por /api/payments/[id]/proof-signed-url
      // ou /api/storage/payment-proof/preview, que validam workspace/RBAC.
      proofFileUrl = objectPath;
      console.log('[PAYMENT_PROOF][STORED_PROOF_PATH]', proofFileUrl);
    }

    console.log('[PAYMENT_PROOF][UPLOAD_RESULT]', {
      eventId,
      workspaceId,
      proofFileName,
      proofFileUrl,
    });

    const noteWithAttachment = [notes, proofFileName ? `Arquivo: ${proofFileName}` : null]
      .filter(Boolean)
      .join(' | ');

    const { data: insertedPayment, error: paymentInsertError } = await supabase
      .from('payments')
      .insert({
        workspace_id: workspaceId,
        event_id: eventId,
        amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        status: 'em_analise',
        notes: noteWithAttachment || null,
        proof_file_url: proofFileUrl,
      })
      .select('id, workspace_id, amount, payment_date, payment_method, status, notes, proof_file_url, created_at')
      .single();

    if (paymentInsertError) throw paymentInsertError;

    const paymentUpdatePayload = {
      paid_amount: nextPaidAmount,
      open_amount: nextOpenAmount,
      payment_status: paymentStatus,
    };
    console.log('[PAYMENT_PROOF][PAYMENT_UPDATE_PAYLOAD]', {
      eventId,
      workspaceId,
      payload: paymentUpdatePayload,
    });

    const { error: updateEventError } = await supabase
      .from('events')
      .update(paymentUpdatePayload)
      .eq('id', eventId)
      .eq('workspace_id', workspaceId);

    if (updateEventError) throw updateEventError;
    console.log('[PAYMENT_PROOF][PAYMENT_UPDATE_RESULT]', {
      eventId,
      workspaceId,
      ok: true,
    });

    const appBaseUrl = resolveAppBaseUrl(request);
    const adminPaymentsLink = appBaseUrl
      ? `${appBaseUrl}/a/pagamento/${insertedPayment.id}`
      : `/a/pagamento/${insertedPayment.id}`;

    const alertMessage = [
      `💰 Novo pagamento informado por ${eventRow.client_name || 'Cliente'}`,
      `Valor pago: ${formatMoney(amount)}`,
      `Total do contrato: ${formatMoney(totalAmount)}`,
      `Restante: ${formatMoney(nextOpenAmount)}`,
      `📅 Evento: ${formatDateBR(eventRow.event_date)}`,
      eventRow.location_name ? `📍 Local: ${eventRow.location_name}` : null,
      paymentMethod ? `Forma de pagamento: ${normalizeMethodLabel(paymentMethod)}` : null,
      notes ? `Obs: ${notes}` : null,
      proofFileUrl ? 'Comprovante: disponível no app' : null,
      `Abrir no app: ${adminPaymentsLink}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await sendAdminWhatsAppAlert(alertMessage);
    } catch (whatsappError) {
      console.error('[API CLIENTE PAGAMENTOS] Falha ao enviar alerta admin:', whatsappError);
    }

    return NextResponse.json({
      ok: true,
      payment: insertedPayment,
      financeiro: {
        valorTotal: totalAmount,
        valorPago: nextPaidAmount,
        saldo: nextOpenAmount,
        status: paymentStatus,
      },
    });
  } catch (error) {
    console.error('[API CLIENTE PAGAMENTOS] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Não foi possível informar o pagamento.' },
      { status: 500 }
    );
  }
}
