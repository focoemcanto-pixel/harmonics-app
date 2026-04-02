import { NextResponse } from 'next/server';

/**
 * Rota de teste interno para o motor de automação.
 * Permite disparar manualmente um evento para verificar o funcionamento.
 *
 * ⚠️ Uso interno apenas — não expor publicamente em produção.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { eventType, entityId, workspaceId } = body;

    if (!eventType || !entityId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: eventType, entityId' },
        { status: 400 }
      );
    }

    // Chamar o motor principal internamente
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/automation/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, entityId, workspaceId }),
    });

    const result = await response.json();

    return NextResponse.json(
      {
        ok: response.ok,
        test: true,
        eventType,
        entityId,
        ...result,
      },
      { status: response.status }
    );
  } catch (error) {
    console.error('[POST /api/automation/test] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
