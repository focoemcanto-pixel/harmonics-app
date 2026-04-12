import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-whatsapp-message';

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

function parseLocalDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntilEvent(dateValue) {
  const target = parseLocalDate(dateValue);
  if (!target) return null;

  const now = startOfDay(new Date()).getTime();
  const targetDay = startOfDay(target).getTime();
  return Math.round((targetDay - now) / 86400000);
}

function isRepertoireFinalized(status) {
  const normalized = String(status || '').trim().toUpperCase();
  return ['ENVIADO', 'ENVIADO_TRANCADO', 'FINALIZADO', 'CONCLUIDO'].includes(normalized);
}

export async function POST(request) {
  try {
    const supabase = getAdminSupabase();
    const body = await request.json();
    const token = normalizeText(body?.token);

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token é obrigatório.' }, { status: 400 });
    }

    const { data: precontract, error: precontractError } = await supabase
      .from('precontracts')
      .select('event_id, client_name, client_phone, public_token')
      .eq('public_token', token)
      .maybeSingle();

    if (precontractError) throw precontractError;
    if (!precontract?.event_id) {
      return NextResponse.json({ ok: false, error: 'Token inválido.' }, { status: 404 });
    }

    const [{ data: eventRow, error: eventError }, { data: configRow, error: configError }] = await Promise.all([
      supabase
        .from('events')
        .select('id, event_date')
        .eq('id', precontract.event_id)
        .maybeSingle(),
      supabase
        .from('repertoire_config')
        .select('status, reminder_15d_whatsapp_sent_at')
        .eq('event_id', precontract.event_id)
        .maybeSingle(),
    ]);

    if (eventError) throw eventError;
    if (configError) throw configError;

    const daysLeft = daysUntilEvent(eventRow?.event_date);
    const shouldWarn = daysLeft !== null && daysLeft <= 15;
    const finalized = isRepertoireFinalized(configRow?.status);

    if (!shouldWarn || finalized) {
      return NextResponse.json({ ok: true, shouldWarn: false, sent: false });
    }

    const alreadySent = Boolean(configRow?.reminder_15d_whatsapp_sent_at);

    if (!alreadySent && precontract.client_phone) {
      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || '';
      const panelUrl = appBaseUrl ? `${appBaseUrl}/cliente/${precontract.public_token}` : `/cliente/${precontract.public_token}`;
      const message =
        `Faltam 15 dias para o seu evento e seu repertório ainda não foi enviado. ` +
        `Envie o quanto antes para que nossa equipe tenha tempo hábil para se preparar.\n\n` +
        `Acesse: ${panelUrl}`;

      try {
        await sendWhatsAppMessage({
          to: precontract.client_phone,
          message,
        });

        await supabase
          .from('repertoire_config')
          .upsert(
            {
              event_id: precontract.event_id,
              reminder_15d_whatsapp_sent_at: new Date().toISOString(),
              status: configRow?.status || 'NAO_ENVIADO',
            },
            { onConflict: 'event_id' }
          );
      } catch (whatsappError) {
        console.error('[ALERTA REPERTORIO] Falha no envio WhatsApp:', whatsappError);
      }
    }

    return NextResponse.json({ ok: true, shouldWarn: true, sent: !alreadySent });
  } catch (error) {
    console.error('[ALERTA REPERTORIO] Erro:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Falha ao processar alerta de repertório pendente.',
      },
      { status: 500 }
    );
  }
}
