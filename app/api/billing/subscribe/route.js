import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';
import { createCustomer, createSubscription } from '@/src/lib/asaas/client';

export async function POST(request) {
  try {
    const { planSlug } = await request.json();
    if (!planSlug) return NextResponse.json({ error: 'Plano obrigatório.' }, { status: 400 });

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: 'Faça login para assinar.' }, { status: 401 });

    const ctx = await getCurrentWorkspace({ request });
    const workspaceId = ctx?.workspace?.id;
    if (!workspaceId) return NextResponse.json({ error: 'Workspace não encontrado.' }, { status: 400 });

    const { data: plan } = await supabase.from('workspace_plans').select('*').eq('slug', planSlug).eq('is_active', true).single();
    if (!plan) return NextResponse.json({ error: 'Plano inválido.' }, { status: 404 });

    const { data: profile } = await supabase.from('profiles').select('full_name, phone, email').eq('id', user.id).single();
    let { data: subscription } = await supabase.from('workspace_subscriptions').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(1).maybeSingle();

    let customerId = subscription?.asaas_customer_id;
    if (!customerId) {
      const customer = await createCustomer({
        name: profile?.full_name || user.email,
        email: profile?.email || user.email,
        mobilePhone: profile?.phone || undefined,
        externalReference: workspaceId,
      });
      customerId = customer.id;
    }

    const startDate = new Date().toISOString().slice(0, 10);
    const asaasSubscription = await createSubscription({
      customer: customerId,
      billingType: 'UNDEFINED',
      value: Number(plan.monthly_price || 0),
      nextDueDate: startDate,
      cycle: 'MONTHLY',
      description: `Assinatura Harmonics ${plan.name}`,
      externalReference: workspaceId,
    });

    const updatePayload = {
      plan_id: plan.id,
      status: 'trialing',
      provider: 'asaas',
      asaas_customer_id: customerId,
      asaas_subscription_id: asaasSubscription.id,
      asaas_payment_id: asaasSubscription?.payment?.id || null,
      next_billing_at: asaasSubscription?.nextDueDate || null,
    };

    if (subscription?.id) {
      await supabase.from('workspace_subscriptions').update(updatePayload).eq('id', subscription.id);
    } else {
      await supabase.from('workspace_subscriptions').insert({ workspace_id: workspaceId, ...updatePayload });
    }

    return NextResponse.json({ ok: true, checkoutUrl: asaasSubscription.invoiceUrl || asaasSubscription.remoteCheckoutUrl || null });
  } catch (error) {
    console.error('[billing.subscribe] error', error);
    return NextResponse.json({ error: error.message || 'Erro ao criar assinatura.' }, { status: 500 });
  }
}
