import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { SIMULATION_SESSIONS, decideSimulationReview, isSimulationId, simulationLinkStatus, summarizeSimulationProposal, supervisionEnabled } from '@/lib/ai/commercial/simulation-supervision.mjs';
import { buildSimulationDocument, simulationContractPending, simulationDocumentPage, SIMULATION_DOCUMENT_CSP } from '@/lib/ai/commercial/simulation-contract';
import { isSensitiveValue } from '@/lib/ai/commercial/memory.mjs';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
const reply = (data, status = 200) => NextResponse.json(data, { status, headers });
const unavailable = () => reply({ ok: false, error: 'Não foi possível carregar o fechamento de teste.' }, 503);
const stale = () => reply({ ok: false, error: 'A conversa mudou. Confira a versão atual antes de decidir.' }, 409);

async function getSession(guard, id) {
  return guard.supabase.from(SIMULATION_SESSIONS).select('id, revision, state')
    .eq('workspace_id', guard.auth.workspaceId).eq('id', id).maybeSingle();
}

async function getDocument(guard, state) {
  if (!state.closing) return null;
  if (state.closing.document) return state.closing.document;
  return buildSimulationDocument({ supabase: guard.supabase, workspaceId: guard.auth.workspaceId,
    closing: state.closing, fallbackLead: state.lead });
}

function proposal(closing, lead) {
  const summary = summarizeSimulationProposal(closing, lead);
  return { ...summary, pending: simulationContractPending(summary.name, summary.address) };
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
    if (error) return unavailable();
    if (token !== null) {
      const closing = data?.state?.closing;
      const status = simulationLinkStatus(closing, token);
      if (status === 200 && closing.document && request.headers.get('accept')?.includes('text/html')) {
        return new NextResponse(simulationDocumentPage(closing.document.html), { headers: {
          ...headers, 'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': SIMULATION_DOCUMENT_CSP + "; sandbox; frame-ancestors 'none'",
        } });
      }
      return reply({ ok: status === 200, simulated: true, expiresAt: status === 200 ? closing.expiresAt : undefined,
        message: status === 200 ? 'Link fictício válido.' : status === 410 ? 'Link de teste expirado.' : 'Link de teste indisponível.' }, status);
    }
    if (!data) return reply({ ok: false }, 404);
    if (searchParams.has('review')) {
      const { state, revision } = data;
      if (!state.closing) return reply({ ok: false }, 404);
      let document;
      try { document = await getDocument(guard, state); }
      catch { return unavailable(); }
      return reply({ ok: true, review: {
        ...proposal(state.closing, state.lead), id, revision,
        versions: (state.versions || []).map(version => proposal(version, state.lead)),
        document: document && { ...document, html: simulationDocumentPage(document.html) },
        link: simulationLinkStatus(state.closing, state.closing.token) === 200
          ? state.messages.findLast(message => message.link)?.link : null,
      } });
    }
    // Chat polling only needs the status, persisted messages and lead.
    const { document, ...closing } = data.state.closing || {};
    return reply({ ok: true, session: { id, revision: data.revision, state: {
      closing: data.state.closing ? closing : null, messages: data.state.messages, lead: data.state.lead,
    } } });
  }
  const offset = Number(searchParams.get('offset') || 0);
  if (!Number.isSafeInteger(offset) || offset < 0) return reply({ ok: false }, 400);
  const pageSize = 100;
  // Project only the card fields. Transcripts, tokens and HTML stay out of the queue response.
  const { data, error } = await guard.supabase.from(SIMULATION_SESSIONS).select(
    'id,revision,summary:state->closing->summary,status:state->closing->>status,expiresAt:state->closing->>expiresAt,' +
    'testExpiredAt:state->closing->>testExpiredAt,lead:state->lead,confirmedLead:state->closing->lead')
    .eq('workspace_id', guard.auth.workspaceId).not('state->closing->>status', 'is', null)
    .order('updated_at', { ascending: false }).order('id').range(offset, offset + pageSize - 1);
  if (error) return unavailable();
  return reply({ ok: true, more: data.length === pageSize, sessions: data.map(({ id, revision, lead, confirmedLead, status, summary, expiresAt, testExpiredAt }) => {
    if (status === 'approved' && (testExpiredAt || Date.parse(expiresAt) <= Date.now())) status = 'expired';
    return { ...proposal({ status, summary, expiresAt, lead: confirmedLead }, lead), id, revision };
  }) });
}

export async function POST(request) {
  if (!supervisionEnabled()) return reply({ enabled: false }, 404);
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][SIMULATION_REVIEW]' });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null);
  if (!isSimulationId(body?.id) || !Number.isInteger(body?.revision) || !['approve', 'adjust', 'reject', 'expire'].includes(body.action)) return reply({ ok: false }, 400);
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
  if (['adjust', 'reject'].includes(body.action) && !reason) return reply({ ok: false, error: 'Informe o motivo da decisão.' }, 400);
  if (isSensitiveValue(reason)) return reply({ ok: false, error: 'Use apenas dados fictícios no motivo.' }, 400);
  const { data, error } = await getSession(guard, body.id);
  if (error) return unavailable();
  if (!data || data.revision !== body.revision) return stale();
  let document;
  if (body.action === 'approve') {
    if (data.state.closing?.status !== 'awaiting_approval') return stale();
    try { document = await getDocument(guard, data.state); }
    catch { return unavailable(); }
    if (!document) return reply({ ok: false, error: 'O tipo de evento precisa de um modelo contratual para aprovar.' }, 422);
    if (document.hash !== body.documentHash) return reply({ ok: false, error: 'O documento mudou. Abra a prévia atual e revise antes de aprovar.' }, 409);
  }
  const state = decideSimulationReview(data.state, { action: body.action, reason, actor: guard.auth.userId, document });
  if (!state) return stale();
  const { data: changed, error: updateError } = await guard.supabase.from(SIMULATION_SESSIONS)
    .update({ state, revision: data.revision + 1, updated_at: new Date().toISOString() })
    .eq('workspace_id', guard.auth.workspaceId).eq('id', body.id).eq('revision', data.revision).select('id').maybeSingle();
  if (updateError) return unavailable();
  return changed ? reply({ ok: true }) : stale();
}
