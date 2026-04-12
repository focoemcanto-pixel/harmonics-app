import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAdminWhatsAppAlert } from '@/lib/whatsapp/send-admin-alert';

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

export async function POST(request) {
  try {
    const supabase = getAdminSupabase();
    const body = await request.json();

    const token = normalizeText(body?.token);
    const amount = parseAmount(body?.amount);
    const paymentDate = normalizeText(body?.paymentDate);
    const notes = normalizeText(body?.notes);
    const paymentMethod = normalizeText(body?.paymentMethod) || 'pix';
    const proofFileName = normalizeText(body?.proofFileName);

    if (!token || !amount || !paymentDate) {
      return NextResponse.json(
        { ok: false, error: 'Campos obrigatórios: token, amount, paymentDate.' },
        { status: 400 }
      );
    }

    const { data: precontract, error: precontractError } = await supabase
      .from('precontracts')
      .select('event_id, public_token')
      .eq('public_token', token)
      .maybeSingle();

    if (precontractError) throw precontractError;

    if (!precontract?.event_id) {
      return NextResponse.json({ ok: false, error: 'Token inválido.' }, { status: 404 });
    }

    const eventId = precontract.event_id;

    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id, client_name, event_date, agreed_amount, paid_amount, open_amount, location_name')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!eventRow) {
      return NextResponse.json({ ok: false, error: 'Evento não encontrado.' }, { status: 404 });
    }

    const currentPaidAmount = Number(eventRow.paid_amount || 0);
    const totalAmount = Number(eventRow.agreed_amount || 0);
    const nextPaidAmount = currentPaidAmount + amount;
    const nextOpenAmount = Math.max(totalAmount - nextPaidAmount, 0);
    const paymentStatus = nextOpenAmount <= 0 && totalAmount > 0 ? 'Pago' : 'Parcial';

    const noteWithAttachment = [notes, proofFileName ? `Arquivo: ${proofFileName}` : null]
      .filter(Boolean)
      .join(' | ');

    const { data: insertedPayment, error: paymentInsertError } = await supabase
      .from('payments')
      .insert({
        event_id: eventId,
        amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        status: 'pending',
        notes: noteWithAttachment || null,
      })
      .select('id, amount, payment_date, payment_method, status, notes, proof_file_url')
      .single();

    if (paymentInsertError) throw paymentInsertError;

    const { error: updateEventError } = await supabase
      .from('events')
      .update({
        paid_amount: nextPaidAmount,
        open_amount: nextOpenAmount,
        payment_status: paymentStatus,
      })
      .eq('id', eventId);

    if (updateEventError) throw updateEventError;

    const alertMessage = [
      `💰 Novo pagamento informado por ${eventRow.client_name || 'Cliente'}`,
      `Valor pago: ${formatMoney(amount)}`,
      `Total do contrato: ${formatMoney(totalAmount)}`,
      `Restante: ${formatMoney(nextOpenAmount)}`,
      `📅 Evento: ${formatDateBR(eventRow.event_date)}`,
      eventRow.location_name ? `📍 Local: ${eventRow.location_name}` : null,
      paymentMethod ? `Forma de pagamento: ${normalizeMethodLabel(paymentMethod)}` : null,
      notes ? `Obs: ${notes}` : null,
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
      {
        ok: false,
        error: error?.message || 'Não foi possível registrar o pagamento.',
      },
      { status: 500 }
    );
  }
}
