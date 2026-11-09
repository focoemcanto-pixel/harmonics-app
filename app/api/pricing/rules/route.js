import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { isWorkspaceOwner } from '@/lib/ai/commercial/owner.mjs';
import { planRuleChange } from '@/lib/quotes/rule-change.mjs';

export const dynamic = 'force-dynamic';

// Tabelas oficiais de preço (fonte única da Nara, Orçamentos, Eventos e painel do cliente).
// GET: Owner/Admin consultam regras e histórico. POST: só o Owner cria nova vigência (atômica e auditada).
export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[PRICING_RULES]' });
  if (!guard.ok) return guard.response;
  const ws = guard.auth.workspaceId;
  const [rules, changes] = await Promise.all([
    guard.supabase.from('quote_price_rules').select('id, category, item_key, label, amount, valid_from, valid_until, metadata')
      .eq('workspace_id', ws).order('category').order('item_key').order('valid_from'),
    guard.supabase.from('quote_price_rule_changes').select('id, actor, category, item_key, reason, closed_rule, new_rule, created_at')
      .eq('workspace_id', ws).order('created_at', { ascending: false }).limit(30),
  ]);
  if (rules.error) return NextResponse.json({ ok: false, error: 'Falha ao ler as regras.' }, { status: 500 });
  return NextResponse.json({ ok: true, is_owner: isWorkspaceOwner(guard.auth), rules: rules.data || [], changes: changes.error ? [] : changes.data || [] });
}

const ERRORS = {
  state_changed: [409, 'As regras mudaram depois da prévia. Gere a prévia de novo.'],
  rule_exists_same_start: [409, 'Já existe regra com essa data de início.'],
  reason_required: [400, 'Informe o motivo da alteração.'],
  valid_from_required: [400, 'Informe a data de início da vigência.'],
  amount_invalid: [400, 'Valor inválido.'],
  category_invalid: [400, 'Categoria inválida.'],
  item_key_invalid: [400, 'Item inválido.'],
};

export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[PRICING_RULES]' });
  if (!guard.ok) return guard.response;
  if (!isWorkspaceOwner(guard.auth)) return NextResponse.json({ ok: false, error: 'Somente o Owner altera tabelas de preço.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== true) return NextResponse.json({ ok: false, error: 'Confirmação explícita obrigatória.' }, { status: 400 });
  const plan = planRuleChange({ existing: [], change: body });
  if (!plan.ok) {
    const [status, error] = ERRORS[plan.errors[0]] || [400, 'Alteração inválida.'];
    return NextResponse.json({ ok: false, code: plan.errors[0], error }, { status });
  }
  const { data, error } = await guard.supabase.rpc('apply_price_rule_change', {
    p_workspace_id: guard.auth.workspaceId, p_actor: guard.auth.userId, p_category: body.category, p_item_key: String(body.item_key).trim(),
    p_label: body.label || null, p_amount: Number(body.amount), p_valid_from: body.valid_from, p_reason: String(body.reason || ''),
    p_expected_hash: String(body.expected_hash || ''),
  });
  if (error) {
    const code = Object.keys(ERRORS).find((k) => String(error.message || '').includes(k));
    const [status, msg] = ERRORS[code] || [500, 'Falha ao gravar a alteração.'];
    return NextResponse.json({ ok: false, code: code || 'error', error: msg }, { status });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, rule_id: row?.rule_id || null, closed_rule_id: row?.closed_rule_id || null, valid_until: row?.new_valid_until || null });
}
