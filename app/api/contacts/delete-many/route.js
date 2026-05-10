import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { deleteContactsByIds } from '@/lib/contacts/delete-contacts';

function uniqIds(list = []) {
  return Array.from(new Set(list.map((id) => String(id || '').trim()).filter(Boolean)));
}

async function filterWorkspaceContactIds({ supabase, contactIds, workspaceId }) {
  const ids = uniqIds(contactIds);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('contacts')
    .select('id')
    .eq('workspace_id', workspaceId)
    .in('id', ids);

  if (error) throw error;
  return uniqIds((data || []).map((row) => row.id));
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'contacts',
      actionKey: 'write',
      logPrefix: '[CONTACTS_DELETE_MANY]',
    });

    if (!auth.ok) {
      return NextResponse.json(auth, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedContactIds = uniqIds(Array.isArray(body?.contactIds) ? body.contactIds : []);

    console.info('[CONTACTS_DELETE_MANY][DELETE][TABLE]', { table: 'contacts' });
    console.info('[CONTACTS_DELETE_MANY][DELETE][IDS]', {
      requestedContactIds,
      workspaceId: auth.workspaceId,
    });

    if (requestedContactIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecione ao menos um contato.' }, { status: 400 });
    }

    const contactIds = await filterWorkspaceContactIds({
      supabase,
      contactIds: requestedContactIds,
      workspaceId: auth.workspaceId,
    });

    if (contactIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Nenhum contato válido encontrado neste workspace.' },
        { status: 404 }
      );
    }

    const result = await deleteContactsByIds({ supabase, contactIds });

    console.info('[CONTACTS_DELETE_MANY][DELETE][RESULT]', {
      requested: result.requested,
      success: result.success.length,
      failed: result.failed.length,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      success: true,
      deleted: result.success.length,
      failedCount: result.failed.length,
    });
  } catch (error) {
    console.error('[CONTACTS_DELETE_MANY][DELETE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao excluir contatos.' },
      { status: 500 }
    );
  }
}
