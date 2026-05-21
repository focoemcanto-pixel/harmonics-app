import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cancelSubscription } from '@/src/lib/asaas/client';

export async function POST() {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { data: sub } = await supabase
      .from('workspace_subscriptions')
      .select('*')
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.asaas_subscription_id) return NextResponse.json({ error: 'Assinatura Asaas não encontrada.' }, { status: 404 });

    await cancelSubscription(sub.asaas_subscription_id);
    await supabase.from('workspace_subscriptions').update({ status: 'cancelled', canceled_at: new Date().toISOString() }).eq('id', sub.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Erro ao cancelar.' }, { status: 500 });
  }
}
