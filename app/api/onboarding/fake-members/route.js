import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { MIN_FAKE_MEMBERS, ONBOARDING_DEMO_NOTE_MARKER } from '@/lib/onboarding/fakeMembers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


const DEMO_MEMBER_SUGGESTIONS = [
  {
    name: 'João Piano',
    tag: 'Piano',
    phone: '11900000001',
    email: 'joao.piano@demo.harmonics.test',
    notes: 'Membro fake para simulação de escala. Função operacional: Piano.',
    contact_type: 'musician',
  },
  {
    name: 'Maria Voz',
    tag: 'Voz',
    phone: '11900000002',
    email: 'maria.voz@demo.harmonics.test',
    notes: 'Membro fake para simulação de escala. Função operacional: Voz.',
    contact_type: 'musician',
  },
  {
    name: 'Pedro Violino',
    tag: 'Violino',
    phone: '11900000003',
    email: 'pedro.violino@demo.harmonics.test',
    notes: 'Membro fake para simulação de escala. Função operacional: Violino.',
    contact_type: 'musician',
  },
  {
    name: 'Lucas Sax',
    tag: 'Sax',
    phone: '11900000004',
    email: 'lucas.sax@demo.harmonics.test',
    notes: 'Membro fake para simulação de escala. Função operacional: Sax.',
    contact_type: 'musician',
  },
];

const CONTACTS_SELECT = 'id, workspace_id, created_at, name, email, phone, tag, notes, contact_type, is_active';
const CONTACTS_SELECT_WITH_DEMO_COLUMNS = `${CONTACTS_SELECT}, source, metadata`;

function asString(value) {
  return String(value || '').trim();
}

function cleanPhone(value) {
  return asString(value).replace(/\D/g, '');
}

function withDemoMarker(notes) {
  const cleaned = asString(notes);
  if (cleaned.includes(ONBOARDING_DEMO_NOTE_MARKER)) return cleaned;
  return [cleaned, ONBOARDING_DEMO_NOTE_MARKER].filter(Boolean).join('\n');
}

function normalizeContactPayload(raw = {}, workspaceId) {
  return {
    workspace_id: workspaceId,
    name: asString(raw.name),
    email: asString(raw.email) || null,
    phone: cleanPhone(raw.phone),
    tag: asString(raw.tag) || null,
    notes: withDemoMarker(raw.notes),
    contact_type: asString(raw.contact_type) || 'musician',
    is_active: raw.is_active !== false,
  };
}

function buildDemoInsertPayload(contactPayload) {
  return {
    ...contactPayload,
    source: 'onboarding_demo',
    metadata: {
      is_onboarding_demo: true,
      source: 'onboarding_demo',
      guide: 'fake-members',
    },
  };
}

async function fetchDemoMembers({ supabase, workspaceId }) {
  let response = await supabase
    .from('contacts')
    .select(CONTACTS_SELECT_WITH_DEMO_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .in('contact_type', ['musician', 'staff'])
    .or(`notes.ilike.%${ONBOARDING_DEMO_NOTE_MARKER}%,source.eq.onboarding_demo`)
    .order('created_at', { ascending: false });

  if (!response.error) return response.data || [];

  const message = `${response.error?.message || ''} ${response.error?.details || ''} ${response.error?.hint || ''}`;
  const missingOptionalDemoColumns = /source|metadata|schema cache|column/i.test(message);
  if (!missingOptionalDemoColumns) throw response.error;

  response = await supabase
    .from('contacts')
    .select(CONTACTS_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .in('contact_type', ['musician', 'staff'])
    .ilike('notes', `%${ONBOARDING_DEMO_NOTE_MARKER}%`)
    .order('created_at', { ascending: false });

  if (response.error) throw response.error;
  return response.data || [];
}

async function insertDemoContact({ supabase, payload }) {
  const richPayload = buildDemoInsertPayload(payload);
  let response = await supabase
    .from('contacts')
    .insert([richPayload])
    .select(CONTACTS_SELECT)
    .single();

  if (!response.error) return response;

  const message = `${response.error?.message || ''} ${response.error?.details || ''} ${response.error?.hint || ''}`;
  const missingOptionalDemoColumns = /source|metadata|schema cache|column/i.test(message);
  if (!missingOptionalDemoColumns) return response;

  response = await supabase
    .from('contacts')
    .insert([payload])
    .select(CONTACTS_SELECT)
    .single();

  return response;
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      logPrefix: '[ONBOARDING_FAKE_MEMBERS][GET]',
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const members = await fetchDemoMembers({ supabase, workspaceId: auth.workspaceId });
    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      minRequired: MIN_FAKE_MEMBERS,
      fakeMembersCount: members.length,
      hasFakeMembers: members.length >= MIN_FAKE_MEMBERS,
      members,
      suggestions: DEMO_MEMBER_SUGGESTIONS,
    });
  } catch (error) {
    console.error('[ONBOARDING_FAKE_MEMBERS][GET][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao carregar membros demo.' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      requireAdmin: true,
      logPrefix: '[ONBOARDING_FAKE_MEMBERS][POST]',
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = asString(body?.mode) || 'seed';
    const existingMembers = await fetchDemoMembers({ supabase, workspaceId: auth.workspaceId });
    const existingNames = new Set(existingMembers.map((item) => asString(item.name).toLowerCase()).filter(Boolean));

    const sourceMembers = mode === 'single'
      ? [body?.payload || {}]
      : DEMO_MEMBER_SUGGESTIONS.filter((suggestion) => !existingNames.has(suggestion.name.toLowerCase()));

    const created = [];
    for (const raw of sourceMembers) {
      const payload = normalizeContactPayload(raw, auth.workspaceId);
      if (!payload.name) continue;
      if (existingNames.has(payload.name.toLowerCase())) continue;

      const response = await insertDemoContact({ supabase, payload });
      if (response.error) throw response.error;
      if (response.data) {
        created.push(response.data);
        existingNames.add(payload.name.toLowerCase());
      }
    }

    const members = await fetchDemoMembers({ supabase, workspaceId: auth.workspaceId });
    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      created,
      fakeMembersCount: members.length,
      hasFakeMembers: members.length >= MIN_FAKE_MEMBERS,
      minRequired: MIN_FAKE_MEMBERS,
      members,
    });
  } catch (error) {
    console.error('[ONBOARDING_FAKE_MEMBERS][POST][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao criar membros demo.' },
      { status: 500 },
    );
  }
}
