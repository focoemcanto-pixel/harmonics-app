import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdminFromRequest } from '@/lib/api/require-admin';
import { deleteContactsByIds } from '@/lib/contacts/delete-contacts';

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdminFromRequest({ supabase, request, logPrefix: '[CONTACTS_DELETE_MANY]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    const contactIds = Array.isArray(body?.contactIds) ? body.contactIds : [];

    console.info('[CONTACTS_DELETE_MANY][DELETE_BULK][PAYLOAD]', {
      requestedCount: contactIds.length,
    });

    if (contactIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Selecione ao menos um contato.' }, { status: 400 });
    }

    const result = await deleteContactsByIds({ supabase, contactIds });

    console.info('[CONTACTS_DELETE_MANY][DELETE_BULK][RESULT]', {
      requested: result.requested,
      success: result.success.length,
      failed: result.failed.length,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[CONTACTS_DELETE_MANY][DELETE_BULK][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao excluir contatos.' }, { status: 500 });
  }
}
