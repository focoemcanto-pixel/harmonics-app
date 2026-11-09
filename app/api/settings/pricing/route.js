import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api-observability';
import { guardWorkspaceAdmin, guardWorkspaceMember } from '@/lib/api/route-guards';
import { loadWorkspacePricing, loadWorkspaceOfficialPriceRules } from '@/lib/settings/workspace-pricing';

export const dynamic = 'force-dynamic';


async function handleGET(request) {
  const guard = await guardWorkspaceMember(request, { logPrefix: '[GET /api/settings/pricing]' });
  if (!guard.ok) return guard.response;

  const [{ data, error }, official] = await Promise.all([
    loadWorkspacePricing({ supabase: guard.supabase, workspaceId: guard.auth.workspaceId }),
    loadWorkspaceOfficialPriceRules({ supabase: guard.supabase, workspaceId: guard.auth.workspaceId }),
  ]);
  if (error) {
    console.error('[GET /api/settings/pricing][ERROR]', { code: error.code, message: error.message });
    return NextResponse.json({ ok: false, error: 'Não foi possível carregar os preços.' }, { status: 500 });
  }

  // official_rules: regras de preço com vigência (sem custos internos), para o preenchimento por data do evento.
  return NextResponse.json({ ok: true, pricing: data || null, official_rules: official?.error ? [] : official?.data || [] });
}

async function handlePUT(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[PUT /api/settings/pricing]' });
  if (!guard.ok) return guard.response;
  // Tabela antiga do Eventos: somente leitura. Preços oficiais com vigência são alterados na Central
  // (POST /api/pricing/rules, somente Owner, auditado).
  return NextResponse.json(
    { ok: false, code: 'LEGACY_PRICING_READ_ONLY', error: 'A tabela antiga do Eventos é somente leitura. Altere os preços em Central → Tabelas.' },
    { status: 423 },
  );
}

export const GET = withApiObservability(handleGET, { route: '/api/settings/pricing' });

export const PUT = withApiObservability(handlePUT, { route: '/api/settings/pricing' });
