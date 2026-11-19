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
    if (!eventId) {
      return NextResponse.json({ ok: false, error: 'Token inválido.' }, { status: 404 });
    }

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
    const nextPaidAmount = currentPaidAmount;
    const nextOpenAmount = Math.max(totalAmount - nextPaidAmount, 0);
    const paymentStatus = nextOpenAmount <= 0 && totalAmount > 0 ? 'Pago' : currentPaidAmount > 0 ? 'Parcial' : 'Pendente';

    let proofFileUrl = null;
    let digest = null;
    if (proofFile) {
      const bucketName = resolvePaymentProofBucketName();
      const arrayBuffer = await proofFile.arrayBuffer();
      const hash = await crypto.subtle.digest('SHA-256', arrayBuffer);
      digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
      const extension = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[proofFile.type] || 'bin';
      const objectPath = buildWorkspacePaymentProofPath({
        workspaceId,
        eventId,
        fileName: `${digest}.${extension}`,
      });
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(objectPath, arrayBuffer, {
          contentType: proofFile.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError && String(uploadError.statusCode) !== '409' && uploadError.error !== 'Duplicate') throw uploadError;

      // Segurança multi-tenant: armazenar apenas o path interno.
      // A abertura deve passar por /api/payments/[id]/proof-signed-url
      // ou /api/storage/payment-proof/preview, que validam workspace/RBAC.
      proofFileUrl = objectPath;
    }

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
        ...(digest ? { proof_sha256: digest } : {}),
      })
      .select('id, workspace_id, amount, payment_date, payment_method, status, notes, proof_file_url, created_at')
      .single();

    if (paymentInsertError?.code === '23505' && digest) {
      const { data: previous, error } = await supabase.from('payments')
        .select('id, workspace_id, amount, payment_date, payment_method, status, notes, proof_file_url, created_at')
        .eq('workspace_id', workspaceId).eq('event_id', eventId).eq('proof_sha256', digest).maybeSingle();
      if (error || !previous) throw paymentInsertError;
      if (Number(previous.amount) !== amount || previous.payment_date !== paymentDate || previous.payment_method !== paymentMethod) {
        return NextResponse.json({ ok: false, error: 'Este comprovante já está associado a outro lançamento. Solicite revisão da equipe.' }, { status: 409 });
      }
      return NextResponse.json({ ok: true, duplicate: true, payment: previous,
        financeiro: { valorTotal: totalAmount, valorPago: currentPaidAmount, saldo: nextOpenAmount, status: paymentStatus } });
    }
    if (paymentInsertError) throw paymentInsertError;

    const appBaseUrl = resolveAppBaseUrl(request);
    const adminPaymentsLink = appBaseUrl
      ? `${appBaseUrl}/a/pagamento/${insertedPayment.id}`
      : `/a/pagamento/${insertedPayment.id}`;

    const alertMessage = [
      `💰 Novo pagamento informado por ${eventRow.client_name || 'Cliente'}`,
      `Valor informado: ${formatMoney(amount)}`,
      `Total do contrato: ${formatMoney(totalAmount)}`,
      `Saldo confirmado antes da conciliação: ${formatMoney(nextOpenAmount)}`,
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
      await sendAdminWhatsAppAlert(alertMessage, { workspaceId });
    } catch {
      console.error('[API CLIENTE PAGAMENTOS] Falha ao enviar alerta admin.');
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
    console.error('[API CLIENTE PAGAMENTOS] Erro ao registrar lançamento.');
    return NextResponse.json(
      { ok: false, error: error?.message || 'Não foi possível informar o pagamento.' },
      { status: 500 }
    );
  }
}
