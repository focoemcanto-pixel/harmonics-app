import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { getAutomaticSuggestionCollections } from '@/lib/sugestoes/automatic-collections';
import { isMissingWorkspaceColumnError, logSuggestionScope, migrationRequiredPayload } from '@/lib/sugestoes/workspace-scope';

export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireWorkspaceAccess({ supabase, request, moduleKey: 'sugestoes', actionKey: 'read', logPrefix: '[SUGGESTIONS_AUTOMATIC_COLLECTIONS_API]' });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, collections: [], error: auth.error || 'Acesso não autorizado.' }, { status: auth.status || 401 });
    }

    const collections = await getAutomaticSuggestionCollections(supabase, { workspaceId: auth.workspaceId });
    logSuggestionScope('[sugestoes] automatic collections loaded', { workspaceId: auth.workspaceId, count: collections.length });

    return NextResponse.json({ ok: true, collections, workspaceId: auth.workspaceId });
  } catch (error) {
    if (isMissingWorkspaceColumnError(error)) {
      return NextResponse.json(migrationRequiredPayload('collections'));
    }

    console.error('[sugestoes] error automatic collections', {
      message: error?.message || 'unknown error',
      details: error?.details || null,
      hint: error?.hint || null,
      code: error?.code || null,
    });

    return NextResponse.json({ ok: false, collections: [], error: 'Não foi possível carregar coleções automáticas agora.' }, { status: 200 });
  }
}
