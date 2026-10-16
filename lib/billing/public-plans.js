// Catálogo público de planos — mesma fonte que o backend usa para limites (workspace_plans).
export const PUBLIC_PLAN_COLUMNS =
  'id, slug, name, description, monthly_price, max_members, max_events_per_month, max_whatsapp_messages, can_use_automation, can_use_contracts, can_use_whatsapp, can_use_white_label, sort_order';

export async function loadPublicPlans(supabase) {
  const { data, error } = await supabase
    .from('workspace_plans')
    .select(PUBLIC_PLAN_COLUMNS)
    .eq('is_public', true)
    .order('sort_order', { ascending: true });
  return { plans: data || [], error };
}
