import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTACTS_SELECT_FIELDS =
  'id, workspace_id, created_at, name, email, phone, tag, notes, contact_type, is_active';

function asString(value) {
  return String(value || '').trim();
}

function cleanPhone(value) {
  return asString(value).replace(/\D/g, '');
}

function normalizeContactPayload(payload = {}, workspaceId) {
  return {
    name: asString(payload.name),
    email: asString(payload.email) || null,
    phone: cleanPhone(payload.phone),
    tag: asString(payload.tag) || null,
    notes: asString(payload.notes) || null,
    contact_type: asString(payload.contact_type) || 'musician',
    is_active: payload.is_active !== false,
    workspace_id: workspaceId,
  };
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'contacts',
      actionKey: 'read',
      logPrefix: '[CONTACTS_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, message: auth.error || 'Acesso não autorizado.' },
        { status: auth.status || 401 }
      );
    }

    const workspaceId = auth.workspaceId;

    const { data, error } = await supabase
      .from('contacts')
      .select(CONTACTS_SELECT_FIELDS)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      data: data || [],
      workspaceId,
    });
  } catch (error) {
    console.error('[CONTACTS_API][GET][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro inesperado ao carregar contatos.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'contacts',
      actionKey: 'write',
      logPrefix: '[CONTACTS_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, message: auth.error || 'Acesso não autorizado.' },
        { status: auth.status || 401 }
      );
    }

    const workspaceId = auth.workspaceId;

    const body = await request.json().catch(() => ({}));
    const id = asString(body?.id);
    const payload = normalizeContactPayload(body?.payload || body || {}, workspaceId);

    if (!payload.name) {
      return NextResponse.json({ ok: false, message: 'Informe o nome do contato.' }, { status: 400 });
    }

    let data = null;

    if (id) {
      const { data: existing, error: existingError } = await supabase
        .from('contacts')
        .select('id, workspace_id')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (existingError) throw existingError;

      if (!existing?.id) {
        return NextResponse.json(
          { ok: false, message: 'Contato não encontrado neste workspace.' },
          { status: 404 }
        );
      }

      const response = await supabase
        .from('contacts')
        .update(payload)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select(CONTACTS_SELECT_FIELDS)
        .single();

      if (response.error) throw response.error;
      data = response.data;
    } else {
      const response = await supabase
        .from('contacts')
        .insert([payload])
        .select(CONTACTS_SELECT_FIELDS)
        .single();

      if (response.error) throw response.error;
      data = response.data;
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('[CONTACTS_API][POST][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro inesperado ao salvar contato.',
      },
      { status: 500 }
    );
  }
}
