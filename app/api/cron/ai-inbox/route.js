import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { cronDeniedResponse, verifyCronRequest } from '@/lib/api/server-secrets';
import { runInboxCycle } from '@/lib/ai/inbox/service.mjs';

export const dynamic = 'force-dynamic';

// Garantia do Inbox: reconcilia envios com lease vencido, responde conversas pendentes da IA,
// despacha a fila e aplica a retenção (LGPD). Falha fechada sem CRON_SECRET.
export async function GET(request) {
  const cronAuth = verifyCronRequest(request);
  if (!cronAuth.ok) return cronDeniedResponse(cronAuth, '[AI][CRON]');

  const supabase = getSupabaseAdmin();
  try {
    const cycle = await runInboxCycle({ supabase });
    const url = new URL(request.url);
    let purge = null;
    if (url.searchParams.get('purge') === '1') {
      const { data } = await supabase.rpc('ai_purge_expired_data');
      purge = Array.isArray(data) ? data[0] : data;
    }
    const summary = {
      ok: true,
      reaped: cycle.reaped,
      replies: cycle.replies.length,
      dispatched: cycle.dispatched.length,
      sent: cycle.dispatched.filter((d) => d.status === 'sent').length,
      purge,
    };
    console.info('[AI][CRON]', summary);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[AI][CRON][ERROR]', { message: error?.message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
