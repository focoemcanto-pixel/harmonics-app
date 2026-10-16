import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { executeAutomationEvent } from '@/lib/automation/execute-automation-event';
import { requireAdminServer } from '@/lib/api/require-admin-server';

export async function POST(request) {
  const adminGuard = await requireAdminServer(request);
  if (!adminGuard.ok) {
    return adminGuard.response;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const eventId = String(body?.eventId || '').trim();

    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: 'eventId é obrigatório.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Estado anterior: identifica ESTA liberação na chave de idempotência da automação.
    const { data: previousConfig } = await supabase
      .from('repertoire_config')
      .select('id, status, is_locked, updated_at')
      .eq('event_id', eventId)
      .maybeSingle();
    const wasAlreadyReleased =
      previousConfig?.is_locked === false && String(previousConfig?.status || '') === 'EM_EDICAO';

    const { data: updatedConfig, error } = await supabase
      .from('repertoire_config')
      .update({
        status: 'EM_EDICAO',
        is_locked: false,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .select('id, event_id, status, is_locked, updated_at')
      .maybeSingle();

    if (error) throw error;

    if (!updatedConfig) {
      return NextResponse.json(
        { ok: false, error: 'Configuração de repertório não encontrada.' },
        { status: 404 }
      );
    }

    console.log('[AUTOMATION][REPERTOIRE_REVIEW_RELEASED]', { eventId, wasAlreadyReleased });
    // Cada liberação (repertório que estava travado) notifica 1 vez; liberar de novo um
    // repertório que já estava em edição não é uma nova liberação. Duas chamadas
    // concorrentes leem o mesmo estado anterior e compartilham a mesma chave.
    const releaseStage = `release:${previousConfig?.id || eventId}:${previousConfig?.updated_at || 'unknown'}`;
    await (wasAlreadyReleased
      ? Promise.resolve(null)
      : executeAutomationEvent({
          eventType: 'repertoire_review_released_client',
          entityId: eventId,
          stageKey: releaseStage,
        })
    ).catch((automationError) => {
      console.error('[AUTOMATION][REPERTOIRE_REVIEW_RELEASED] Falha no disparo automático', {
        eventId,
        error: automationError?.message || 'erro desconhecido',
      });
    });

    return NextResponse.json({
      ok: true,
      eventId: updatedConfig.event_id,
      status: updatedConfig.status,
      locked: updatedConfig.is_locked,
      updatedAt: updatedConfig.updated_at,
    });
  } catch (error) {
    console.error('[API ADMIN] Erro ao liberar revisão de repertório:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Não foi possível liberar a revisão.',
      },
      { status: 500 }
    );
  }
}
