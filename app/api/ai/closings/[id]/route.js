import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { approveAndQueueLink, rejectClosing } from '@/lib/ai/commercial/supervision.mjs';
import { dispatchOutbox } from '@/lib/ai/inbox/service.mjs';

export const dynamic = 'force-dynamic';

// Aprovação do pré-contrato preparado pela IA (Manual §20.3): vale para a versão exata (approval_hash).
export async function POST(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][CLOSING]' });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const workspaceId = guard.auth.workspaceId;
  if (body?.action === 'reject') {
    const r = await rejectClosing({ supabase: guard.supabase, workspaceId, closingId: id, actor: guard.auth.userId, reason: body.reason });
    return NextResponse.json(r, { status: r.ok ? 200 : 404 });
  }
  if (body?.action !== 'approve' || typeof body?.approval_hash !== 'string') {
    return NextResponse.json({ ok: false, error: 'Informe action=approve e approval_hash.' }, { status: 400 });
  }
  const result = await approveAndQueueLink({ supabase: guard.supabase, workspaceId, closingId: id, approvalHash: body.approval_hash, actor: guard.auth.userId, mode: 'manual' });
  if (!result.ok) {
    const status = result.status === 'not_found' ? 404 : 409;
    return NextResponse.json({ ok: false, code: result.status, approval_hash: result.approvalHash || null, error: result.status === 'version_changed' ? 'O pré-contrato mudou desde a preparação: revise a nova versão.' : 'Não foi possível aprovar.' }, { status });
  }
  const sent = await dispatchOutbox({ supabase: guard.supabase, workspaceId, limit: 5 });
  const mine = sent.find((s) => s.id === result.outboxId);
  return NextResponse.json({ ok: true, status: result.status, send_status: mine?.status || 'pending', send_error: mine?.error || null });
}
