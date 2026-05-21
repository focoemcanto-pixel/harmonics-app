import { getSupabaseAdmin } from '@/lib/supabase-admin';

type LegacyPayload = {
  email: string;
  name?: string;
  plan: string;
  status: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  next_billing_at?: string | null;
};

export async function resolvePlanByLegacy(planSlug: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('workspace_plans')
    .select('id, slug, name')
    .eq('slug', String(planSlug || '').trim().toLowerCase())
    .maybeSingle();
  return data || null;
}

export async function createOrLinkProfile(email: string, name?: string) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existing?.id) return { profileId: existing.id, created: false };

  const { data: createdUser, error: createErr } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: false,
    user_metadata: {
      full_name: name || null,
      migrated_from_pms: true,
    },
  });

  if (createErr || !createdUser?.user?.id) {
    throw new Error(createErr?.message || 'Falha ao criar usuário placeholder');
  }

  const profileId = createdUser.user.id;

  await supabase.from('profiles').upsert({
    id: profileId,
    email: normalizedEmail,
    name: name || null,
    migrated_from_pms: true,
    migration_completed_at: new Date().toISOString(),
  });

  return { profileId, created: true };
}

export async function syncStripeSubscription(input: LegacyPayload) {
  return {
    ok: false,
    reason: 'stripe_sdk_not_enabled_in_harmonics_app',
    subscriptionId: input.stripe_subscription_id,
    status: input.status,
    currentPeriodEnd: input.next_billing_at || null,
    customerId: input.stripe_customer_id,
  };
}

export async function importStripeMember(input: LegacyPayload & { workspace_id: string }) {
  const supabase = getSupabaseAdmin();
  const plan = await resolvePlanByLegacy(input.plan);

  if (!plan?.id) throw new Error(`Plano legado não mapeado: ${input.plan}`);

  const sync = await syncStripeSubscription(input);
  const linked = await createOrLinkProfile(input.email, input.name);

  const { data: existingSub } = await supabase
    .from('workspace_subscriptions')
    .select('id, status, provider_subscription_id')
    .eq('workspace_id', input.workspace_id)
    .eq('provider_subscription_id', input.stripe_subscription_id)
    .maybeSingle();

  if (existingSub?.id) {
    return {
      ok: true,
      status: 'conflito',
      details: 'Assinatura já importada para este workspace.',
    };
  }

  const subscriptionPayload = {
    workspace_id: input.workspace_id,
    plan_id: plan.id,
    status: input.status,
    provider: 'stripe',
    provider_customer_id: input.stripe_customer_id,
    provider_subscription_id: input.stripe_subscription_id,
    current_period_end: input.next_billing_at || null,
    next_billing_at: input.next_billing_at || null,
    migrated_from_pms: true,
    original_gateway: 'stripe_pms',
    imported_at: new Date().toISOString(),
    metadata: {
      legacy_plan: input.plan,
      migration_source: 'csv',
      stripe_sync: sync,
    },
  };

  await supabase.from('workspace_subscriptions').insert(subscriptionPayload);
  await supabase
    .from('profiles')
    .update({
      migrated_from_pms: true,
      migration_completed_at: new Date().toISOString(),
    })
    .eq('id', linked.profileId);

  await supabase.from('migration_logs').insert({
    email: input.email,
    status: 'importado',
    details: { linkedProfile: linked, sync },
  });

  return { ok: true, status: 'importado', linked };
}
