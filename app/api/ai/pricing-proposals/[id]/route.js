import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { isWorkspaceOwner } from '@/lib/ai/commercial/owner.mjs';

export const dynamic = 'force-dynamic';

// Aprovar proposta = gravar na tabela oficial quote_price_rules (somente Owner). Nunca sobrescreve
// uma regra oficial existente com a mesma vigência.
export async function POST(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][PRICING_PROPOSAL]' });
  if (!guard.ok) return guard.response;
  if (!isWorkspaceOwner(guard.auth)) return NextResponse.json({ ok: false, error: 'Somente o Owner aprova tabelas de preço.' }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const ws = guard.auth.workspaceId;
  const { data: p } = await guard.supabase.from('ai_pricing_proposals').select('*').eq('id', id).eq('workspace_id', ws).eq('status', 'pending').maybeSingle();
  if (!p) return NextResponse.json({ ok: false, error: 'Proposta não encontrada.' }, { status: 404 });
  const now = new Date().toISOString();
  if (body?.decision === 'rejected') {
    await guard.supabase.from('ai_pricing_proposals').update({ status: 'rejected', decided_by: guard.auth.userId, decided_at: now }).eq('id', p.id);
    return NextResponse.json({ ok: true });
  }
  if (body?.decision !== 'approved') return NextResponse.json({ ok: false, error: 'Decisão inválida.' }, { status: 400 });
  const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.valid_from || '')) ? body.valid_from : p.valid_from;
  if (!validFrom) return NextResponse.json({ ok: false, code: 'VALID_FROM_REQUIRED', error: 'Informe a data de início da vigência (data do evento é a referência).' }, { status: 400 });
  if (p.valid_until && p.valid_until < validFrom) return NextResponse.json({ ok: false, error: 'Vigência final anterior à inicial.' }, { status: 400 });
  const { data: clash } = await guard.supabase.from('quote_price_rules').select('id').eq('workspace_id', ws).eq('category', p.category).eq('item_key', p.item_key).eq('valid_from', validFrom).maybeSingle();
  if (clash) return NextResponse.json({ ok: false, code: 'RULE_EXISTS', error: 'Já existe regra oficial com essa vigência; ajuste a data ou edite a regra existente.' }, { status: 409 });
  const { error } = await guard.supabase.from('quote_price_rules').insert({
    workspace_id: ws, category: p.category, item_key: p.item_key, label: p.label, amount: p.amount, valid_from: validFrom, valid_until: p.valid_until,
    metadata: { source: p.source, proposal_id: p.id, ...(p.metadata || {}) },
  });
  if (error) return NextResponse.json({ ok: false, error: 'Falha ao gravar regra oficial.' }, { status: 500 });
  await guard.supabase.from('ai_pricing_proposals').update({ status: 'approved', valid_from: validFrom, decided_by: guard.auth.userId, decided_at: now }).eq('id', p.id);
  return NextResponse.json({ ok: true });
}
