import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { logId } = body;

    if (!logId) {
      return NextResponse.json({ error: 'logId é obrigatório' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Buscar o log original com a regra associada
    const { data: originalLog, error: logError } = await supabaseAdmin
      .from('automation_logs')
      .select('id, status, entity_id, metadata, rule_id, rule:rule_id(event_type)')
      .eq('id', logId)
      .single();

    if (logError || !originalLog) {
      return NextResponse.json({ error: 'Log não encontrado' }, { status: 404 });
    }

    if (originalLog.status !== 'failed') {
      return NextResponse.json(
        { error: 'Apenas logs com status "failed" podem ser re-tentados' },
        { status: 400 }
      );
    }

    // Extrair entity_id e event_type com fallback para rule.event_type
    const entity_id = originalLog.entity_id || originalLog.metadata?.entityId;
    const event_type =
      originalLog.metadata?.eventType || originalLog.rule?.event_type;

    if (!entity_id || !event_type) {
      return NextResponse.json(
        { error: 'Dados insuficientes para retry (entity_id ou event_type ausente)' },
        { status: 400 }
      );
    }

    // Chamar o motor de automação
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/automation/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: event_type, entityId: entity_id }),
    });

    const result = await response.json();

    // Validar resposta — evitar falso sucesso
    if (!response.ok) {
      throw new Error(result?.error || 'Erro no motor de automação');
    }

    return NextResponse.json({
      ok: true,
      message: 'Retry executado com sucesso',
      result,
    });
  } catch (error) {
    console.error('[POST /api/automation/retry] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
