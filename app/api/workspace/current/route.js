import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const context = await getCurrentWorkspace({ supabase, request });

    if (!context?.workspaceId) {
      return NextResponse.json(
        { ok: false, error: 'Workspace não encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      workspaceId: context.workspaceId,
      workspace: context.workspace || null,
      settings: context.settings || null,
      membership: context.member || null,
      role: context.role || null,
      isPlatformAdmin: Boolean(context.isPlatformAdmin),
      source: context.source || null,
    });
  } catch (error) {
    console.error('[WORKSPACE_CURRENT][GET][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao carregar workspace atual.' },
      { status: 500 }
    );
  }
}
