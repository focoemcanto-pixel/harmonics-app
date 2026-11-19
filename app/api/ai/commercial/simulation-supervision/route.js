import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { SIMULATION_SESSIONS, decideSimulationReview, isSimulationId, simulationLinkStatus, supervisionEnabled } from '@/lib/ai/commercial/simulation-supervision.mjs';
import { isSensitiveValue } from '@/lib/ai/commercial/memory.mjs';

export const dynamic = 'force-dynamic';
const reply = (data, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function getSession(guard, id) {
  return guard.supabase.from(SIMULATION_SESSIONS).select('id, revision, state')
    .eq('workspace_id', guard.auth.workspaceId).eq('id', id).maybeSingle();
}

export async function GET(request) {
  if (!supervisionEnabled()) return reply({ enabled: false }, 404);
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][SIMULATION_REVIEW]' });
  if (!guard.ok) return guard.response;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const token = searchParams.get('token');
  if (id) {
    if (!isSimulationId(id)) return reply({ ok: false }, 404);
    const { data, error } = await getSession(guard, id);
    if (error) return reply({ ok: false }, 503);
    if (token !== null) {
      const status = simulationLinkStatus(data?.state?.closing, token);
      return reply({ ok: status === 200, simulated: true, message: status === 200
        ? 'Link fictício válido. No atendimento real, leia, preencha e assine em até 15 dias.'
        : status === 410 ? 'Link de teste expirado.' : 'Link de teste indisponível.' }, status);
    }
    return data ? reply({ ok: true, session: data }) : reply({ ok: false }, 404);
  }
  const { data, error } = await guard.supabase.from(SIMULATION_SESSIONS).select('id,revision,state,updated_at')
    .eq('workspace_id', guard.auth.workspaceId).not('state->closing', 'is', null).order('updated_at', { ascending: false }).limit(50);
  if (error) return reply({ ok: false }, 503);
  return reply({ ok: true, sessions: data.filter(row => row.state.closing).map(({ id, revision, state }) => ({
    id, revision, status: state.closing.status, summary: state.closing.text, reason: state.closing.reason,
    expiresAt: state.closing.expiresAt, testExpiredAt: state.closing.testExpiredAt,
  })) });
}

export async function POST(request) {
  if (!supervisionEnabled()) return reply({ enabled: false }, 404);
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][SIMULATION_REVIEW]' });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null);
  if (!isSimulationId(body?.id) || !Number.isInteger(body?.revision)) return reply({ ok: false }, 400);
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
  if (isSensitiveValue(reason)) return reply({ ok: false, error: 'Não inclua dados sensíveis.' }, 400);
  const { data, error } = await getSession(guard, body.id);
  if (error) return reply({ ok: false }, 503);
  if (!data || data.revision !== body.revision) return reply({ ok: false, error: 'A conversa mudou. Atualize a fila.' }, 409);
  const state = decideSimulationReview(data.state, { action: body.action, reason, actor: guard.auth.userId });
  if (!state) return reply({ ok: false, error: 'Decisão indisponível ou motivo obrigatório.' }, 409);
  const { data: changed, error: updateError } = await guard.supabase.from(SIMULATION_SESSIONS)
    .update({ state, revision: data.revision + 1, updated_at: new Date().toISOString() })
    .eq('workspace_id', guard.auth.workspaceId).eq('id', body.id).eq('revision', data.revision).select('id').maybeSingle();
  if (updateError) return reply({ ok: false }, 503);
  return changed ? reply({ ok: true }) : reply({ ok: false, error: 'Decisão concorrente. Atualize a fila.' }, 409);
}
