import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { isWorkspaceOwner } from '@/lib/ai/commercial/owner.mjs';
import { planRuleChange } from '@/lib/quotes/rule-change.mjs';

export const dynamic = 'force-dynamic';

// Prévia (somente leitura) de uma alteração de preço com vigência. Nada é gravado aqui.
// Mostra as regras que seriam encerradas/criadas e quantos eventos/pré-contratos salvos caem na
// nova vigência — esses mantêm os valores já combinados.
export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[PRICING_RULES_PREVIEW]' });
  if (!guard.ok) return guard.response;
  if (!isWorkspaceOwner(guard.auth)) return NextResponse.json({ ok: false, error: 'Somente o Owner altera tabelas de preço.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const ws = guard.auth.workspaceId;
  const { data: rules, error } = await guard.supabase.from('quote_price_rules')
    .select('id, category, item_key, label, amount, valid_from, valid_until').eq('workspace_id', ws)
    .eq('category', String(body?.category || '')).eq('item_key', String(body?.item_key || ''));
  if (error) return NextResponse.json({ ok: false, error: 'Falha ao ler as regras.' }, { status: 500 });
  const plan = planRuleChange({ existing: rules || [], change: body || {} });
  if (!plan.ok) return NextResponse.json({ ok: false, ...plan }, { status: 400 });
  const insert = plan.ops.find((o) => o.type === 'insert').row;
  const inWindow = (q) => {
    let r = q.eq('workspace_id', ws).gte('event_date', insert.valid_from);
    if (insert.valid_until) r = r.lte('event_date', insert.valid_until);
    return r;
  };
  const [events, precontracts] = await Promise.all([
    inWindow(guard.supabase.from('events').select('id', { count: 'exact', head: true })),
    inWindow(guard.supabase.from('precontracts').select('id', { count: 'exact', head: true })),
  ]);
  const { data: stateHash } = await guard.supabase.rpc('price_rules_state_hash', {
    p_workspace_id: ws, p_category: String(body?.category || ''), p_item_key: String(body?.item_key || ''),
  });
  return NextResponse.json({
    ok: true,
    dry_run: true,
    plan,
    expected_hash: stateHash || null,
    saved_in_window: { events: events.count ?? null, precontracts: precontracts.count ?? null, note: 'Valores já salvos não mudam.' },
  });
}
