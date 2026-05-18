import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { ONBOARDING_DEMO_NOTE_MARKER } from '@/lib/onboarding/fakeMembers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FORMATION_DEMO_NOTE_MARKER = '[onboarding_demo:formation_template]';
const DEMO_TEMPLATE = {
  name: 'Formação Demo Premium',
  formation: 'Trio',
  instruments: 'Voz, Piano, Violino',
  compatible_tags: 'Voz, Piano, Violino',
  suggestion_priority: 1,
  notes: `${FORMATION_DEMO_NOTE_MARKER}\nFormação reutilizável demo para sugerir automaticamente membros compatíveis com cada função.`,
  is_active: true,
};
const REQUIRED_ROLES = ['Voz', 'Piano', 'Violino'];
const CONTACTS_SELECT = 'id, workspace_id, created_at, name, email, phone, tag, notes, contact_type, is_active';
const CONTACTS_SELECT_WITH_DEMO_COLUMNS = `${CONTACTS_SELECT}, source, metadata`;
const TEMPLATE_SELECT = 'id, workspace_id, created_at, updated_at, name, formation, instruments, compatible_tags, suggestion_priority, notes, is_active, source, metadata';
const TEMPLATE_SELECT_FALLBACK = 'id, workspace_id, created_at, updated_at, name, formation, instruments, compatible_tags, suggestion_priority, notes, is_active';

function asString(value) {
  return String(value || '').trim();
}

function normalize(value) {
  return asString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isOptionalColumnError(error) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return /source|metadata|schema cache|column/i.test(message);
}

function buildTemplatePayload(workspaceId) {
  return {
    ...DEMO_TEMPLATE,
    workspace_id: workspaceId,
    source: 'onboarding_demo',
    metadata: {
      is_onboarding_demo: true,
      source: 'onboarding_demo',
      guide: 'formation-template',
      roles: REQUIRED_ROLES,
    },
  };
}

async function fetchDemoTemplates({ supabase, workspaceId }) {
  let response = await supabase
    .from('scale_templates')
    .select(TEMPLATE_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .or(`source.eq.onboarding_demo,metadata->>is_onboarding_demo.eq.true,notes.ilike.%${FORMATION_DEMO_NOTE_MARKER}%`)
    .order('created_at', { ascending: false });

  if (!response.error) return response.data || [];
  if (!isOptionalColumnError(response.error)) throw response.error;

  response = await supabase
    .from('scale_templates')
    .select(TEMPLATE_SELECT_FALLBACK)
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .or(`notes.ilike.%${FORMATION_DEMO_NOTE_MARKER}%`)
    .order('created_at', { ascending: false });

  if (response.error) throw response.error;
  return response.data || [];
}

async function fetchDemoMembers({ supabase, workspaceId }) {
  let response = await supabase
    .from('contacts')
    .select(CONTACTS_SELECT_WITH_DEMO_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .in('contact_type', ['musician', 'member', 'team', 'staff'])
    .or(`notes.ilike.%${ONBOARDING_DEMO_NOTE_MARKER}%,source.eq.onboarding_demo`)
    .order('created_at', { ascending: false });

  if (!response.error) return response.data || [];
  if (!isOptionalColumnError(response.error)) throw response.error;

  response = await supabase
    .from('contacts')
    .select(CONTACTS_SELECT)
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .in('contact_type', ['musician', 'member', 'team', 'staff'])
    .ilike('notes', `%${ONBOARDING_DEMO_NOTE_MARKER}%`)
    .order('created_at', { ascending: false });

  if (response.error) throw response.error;
  return response.data || [];
}

function pickMembersForRoles(members = []) {
  const selected = [];
  const used = new Set();

  for (const role of REQUIRED_ROLES) {
    const roleNorm = normalize(role);
    const match = members.find((member) => {
      if (!member?.id || used.has(String(member.id))) return false;
      return [member.tag, member.notes, member.name]
        .map(normalize)
        .some((value) => value.includes(roleNorm));
    });

    if (match) {
      used.add(String(match.id));
      selected.push({ ...match, onboardingRole: role });
    }
  }

  for (const member of members) {
    if (selected.length >= REQUIRED_ROLES.length) break;
    if (!member?.id || used.has(String(member.id))) continue;
    used.add(String(member.id));
    selected.push({ ...member, onboardingRole: REQUIRED_ROLES[selected.length] || asString(member.tag) || 'Membro' });
  }

  return selected.slice(0, REQUIRED_ROLES.length);
}

async function insertDemoTemplate({ supabase, workspaceId }) {
  const richPayload = buildTemplatePayload(workspaceId);
  let response = await supabase
    .from('scale_templates')
    .insert([richPayload])
    .select('id')
    .single();

  if (!response.error) return response.data;
  if (!isOptionalColumnError(response.error)) throw response.error;

  const fallbackPayload = Object.fromEntries(
    Object.entries(richPayload).filter(([key]) => !['source', 'metadata'].includes(key))
  );
  response = await supabase
    .from('scale_templates')
    .insert([fallbackPayload])
    .select('id')
    .single();

  if (response.error) throw response.error;
  return response.data;
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      logPrefix: '[ONBOARDING_FORMATION_TEMPLATE][GET]',
    });

    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });

    const [templates, members] = await Promise.all([
      fetchDemoTemplates({ supabase, workspaceId: auth.workspaceId }),
      fetchDemoMembers({ supabase, workspaceId: auth.workspaceId }),
    ]);

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      hasFormationTemplate: templates.length > 0,
      formationTemplateCount: templates.length,
      templates,
      members,
      demoTemplate: DEMO_TEMPLATE,
      requiredRoles: REQUIRED_ROLES,
    });
  } catch (error) {
    console.error('[ONBOARDING_FORMATION_TEMPLATE][GET][ERROR]', { message: error?.message, code: error?.code, details: error?.details });
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao carregar formação demo.' }, { status: 500 });
  }
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      requireAdmin: true,
      logPrefix: '[ONBOARDING_FORMATION_TEMPLATE][POST]',
    });

    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });

    const existingTemplates = await fetchDemoTemplates({ supabase, workspaceId: auth.workspaceId });
    if (existingTemplates[0]?.id) {
      return NextResponse.json({
        ok: true,
        workspaceId: auth.workspaceId,
        template: existingTemplates[0],
        hasFormationTemplate: true,
        formationTemplateCount: existingTemplates.length,
        alreadyExisted: true,
      });
    }

    const members = await fetchDemoMembers({ supabase, workspaceId: auth.workspaceId });
    const selectedMembers = pickMembersForRoles(members);
    if (selectedMembers.length === 0) {
      return NextResponse.json({ ok: false, error: 'Crie membros demo antes de montar a formação.' }, { status: 400 });
    }

    const template = await insertDemoTemplate({ supabase, workspaceId: auth.workspaceId });
    const itemsPayload = selectedMembers.map((member, index) => ({
      template_id: template.id,
      contact_id: member.id,
      role: member.onboardingRole || member.tag || REQUIRED_ROLES[index] || null,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase
      .from('scale_template_items')
      .insert(itemsPayload);
    if (itemsError) throw itemsError;

    const templates = await fetchDemoTemplates({ supabase, workspaceId: auth.workspaceId });
    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      template: templates[0] || { id: template.id, ...DEMO_TEMPLATE },
      hasFormationTemplate: true,
      formationTemplateCount: templates.length || 1,
      members: selectedMembers,
    });
  } catch (error) {
    console.error('[ONBOARDING_FORMATION_TEMPLATE][POST][ERROR]', { message: error?.message, code: error?.code, details: error?.details });
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao criar formação demo.' }, { status: 500 });
  }
}
