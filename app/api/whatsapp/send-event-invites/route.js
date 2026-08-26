import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { requireScheduleManagerAccess } from '../../../../lib/api/require-schedule-manager-access';
import { processQueue } from '../../../../lib/utils/asyncQueue';
import { sendInviteService } from '../../../../lib/whatsapp/send-invite-service';

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim()); }
function resolveProviderStatus(inviteResult = {}) {
  const data = inviteResult?.data || {};
  return data?.providerStatus ?? data?.providerError?.status ?? data?.executions?.find?.((execution) => execution?.providerError?.status)?.providerError?.status ?? null;
}
function resolveActualDispatchSuccess(inviteResult = {}) {
  const data = inviteResult?.data || {};
  return inviteResult?.ok === true && (Number(data?.sent || 0) > 0 || data?.skipped === true);
}
function resolveInviteError(inviteResult = {}, providerStatus = null) {
  const data = inviteResult?.data || {};
  const failedExecution = data?.executions?.find?.((execution) => execution?.status === 'failed');
  return data?.error || data?.cause || data?.warning || failedExecution?.error || inviteResult?.error || (providerStatus ? `Provider WhatsApp retornou status ${providerStatus}.` : null) || 'O provedor não confirmou o envio do convite.';
}

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const auth = await requireScheduleManagerAccess({ supabase: supabaseAdmin, request, logPrefix: '[WHATSAPP_SEND_EVENT_INVITES]' });
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    const eventId = String(body?.eventId || '').trim();
    const forcePending = body?.forcePending === true;
    if (!isUuid(eventId)) return NextResponse.json({ ok: false, error: 'eventId inválido ou ausente' }, { status: 400 });

    const { data: eventRow, error: eventError } = await supabaseAdmin.from('events').select('id, workspace_id').eq('id', eventId).maybeSingle();
    if (eventError) throw eventError;
    if (!eventRow?.id) return NextResponse.json({ ok: false, error: 'Evento não encontrado.' }, { status: 404 });
    if (String(eventRow.workspace_id || '') !== String(auth.workspaceId || '')) return NextResponse.json({ ok: false, error: 'Evento não pertence ao workspace ativo.' }, { status: 403 });

    const { data: invites, error } = await supabaseAdmin.from('invites').select('id, status, whatsapp_sent_at, whatsapp_last_error').eq('event_id', eventId).eq('status', 'pending');
    if (error) throw error;

    const pendentes = (invites || []).filter((invite) => isUuid(invite?.id) && (forcePending || !invite.whatsapp_sent_at));
    const results = [];

    await processQueue(pendentes, async (invite) => {
      const sendInvite = async (item, attempt = 1) => {
        // A ação explícita "Salvar e enviar convites" significa reenviar os convites
        // que continuam pendentes, mesmo que já tenham um whatsapp_sent_at antigo.
        if (forcePending && item.whatsapp_sent_at) {
          const { error: resetError } = await supabaseAdmin.from('invites').update({ whatsapp_sent_at: null, whatsapp_last_error: null }).eq('id', item.id).eq('event_id', eventId).eq('status', 'pending');
          if (resetError) throw resetError;
        }

        const inviteResult = await sendInviteService({ inviteId: item.id, supabaseAdmin });
        const providerStatus = resolveProviderStatus(inviteResult);
        if (Number(providerStatus) === 429 && attempt === 1) { await wait(7000); return sendInvite(item, attempt + 1); }

        const actualOk = resolveActualDispatchSuccess(inviteResult);
        const resultItem = { inviteId: item.id, ok: actualOk, status: actualOk ? inviteResult.status : inviteResult.status || 500, response: inviteResult.data || null };
        if (!actualOk) {
          resultItem.error = resolveInviteError(inviteResult, providerStatus);
          resultItem.cause = inviteResult?.data?.cause || resultItem.error;
          resultItem.providerStatus = inviteResult?.data?.providerStatus ?? inviteResult?.data?.providerError?.status ?? providerStatus ?? null;
          resultItem.providerEndpoint = inviteResult?.data?.providerEndpoint ?? inviteResult?.data?.providerError?.endpoint ?? null;
          resultItem.providerResponse = inviteResult?.data?.providerResponse ?? inviteResult?.data?.providerError?.response ?? null;
          console.error('[batch_send_invites] invite_failed', { status: 'failed', eventId, inviteId: item.id, statusCode: inviteResult.status, error: resultItem.error, providerStatus: resultItem.providerStatus, attempt, forcePending });
        }
        results.push(resultItem);
      };
      await sendInvite(invite);
    }, 1200);

    const successCount = results.filter((result) => result.ok === true).length;
    const failedCount = results.length - successCount;
    const hasFailures = failedCount > 0;
    const firstFailed = results.find((result) => result.ok !== true);
    const firstError = firstFailed?.error || firstFailed?.cause || firstFailed?.response?.firstError || firstFailed?.response?.error || firstFailed?.response?.cause || firstFailed?.response?.providerResponse?.error || firstFailed?.response?.providerResponse?.message || firstFailed?.response?.details || (firstFailed ? `Falha no invite ${firstFailed.inviteId} (status ${firstFailed.status})` : null);
    const status = hasFailures ? (successCount > 0 ? 207 : 500) : 200;
    const message = pendentes.length === 0 ? 'Nenhum convite pendente para envio.' : hasFailures ? successCount > 0 ? `Envio parcial: ${successCount} enviado(s) e ${failedCount} falha(s).` : `Nenhum convite foi enviado. ${firstError || 'Falha desconhecida no disparo.'}` : `${successCount} convite(s) enviado(s) com sucesso.`;

    return NextResponse.json({ ok: failedCount === 0, eventId, workspaceId: auth.workspaceId, forcePending, total: pendentes.length, successCount, failedCount, results, firstError, error: hasFailures ? firstError || 'Falha no envio dos convites.' : null, message }, { status });
  } catch (error) {
    console.error('Erro ao enviar convites do evento:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno', firstError: error?.message || 'Erro interno' }, { status: 500 });
  }
}
