import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function uniq(list = []) {
  return Array.from(new Set(list.map((item) => String(item || '').trim()).filter(Boolean)));
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[PAYMENTS_API]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.error }, { status: auth.status || 401 });
    }

    const { workspaceId } = await getCurrentWorkspace({ supabase });

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('event_date', { ascending: true });

    if (eventsError) throw eventsError;

    const eventIds = uniq((events || []).map((event) => event?.id));

    let payments = [];
    if (eventIds.length > 0) {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .in('event_id', eventIds)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;
      payments = paymentsData || [];
    }

    return NextResponse.json({
      ok: true,
      events: events || [],
      payments,
      workspaceId,
      debug: {
        eventsCount: (events || []).length,
        paymentsCount: payments.length,
      },
    });
  } catch (error) {
    console.error('[PAYMENTS_API][GET][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao carregar pagamentos.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[PAYMENTS_API]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.error }, { status: auth.status || 401 });
    }

    const { workspaceId } = await getCurrentWorkspace({ supabase });
    const body = await request.json().catch(() => ({}));
    const payload = body?.payload && typeof body.payload === 'object' ? body.payload : body || {};
    const eventId = String(payload?.event_id || '').trim();

    if (!eventId) {
      return NextResponse.json({ ok: false, message: 'Evento é obrigatório.' }, { status: 400 });
    }

    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id, workspace_id')
      .eq('id', eventId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!eventRow?.id) {
      return NextResponse.json({ ok: false, message: 'Evento não encontrado neste workspace.' }, { status: 404 });
    }

    const writePayload = {
      event_id: eventId,
      amount: Number(payload?.amount || 0),
      payment_date: payload?.payment_date || null,
      payment_method: payload?.payment_method || null,
      status: payload?.status || 'pendente',
      notes: payload?.notes || null,
      proof_file_url: payload?.proof_file_url || null,
      workspace_id: payload?.workspace_id || workspaceId,
    };

    const { data, error } = await supabase
      .from('payments')
      .insert([writePayload])
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('[PAYMENTS_API][POST][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao salvar pagamento.',
      },
      { status: 500 }
    );
  }
}
