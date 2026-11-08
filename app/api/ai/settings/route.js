import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { readGlobalAiFlags } from '@/lib/ai/agent/policy.mjs';
import { encryptSecret } from '@/lib/ai/inbox/secret-box.mjs';
import { parseSettingsInput, parseChannelInput } from '@/lib/ai/inbox/settings-input.mjs';

export const dynamic = 'force-dynamic';

const CHANNEL_PUBLIC = 'id, provider, phone_number_id, waba_id, display_phone, coexistence, status, history_sync_status, last_webhook_at, last_eligibility, updated_at, access_token_encrypted';

function publicChannel(row) {
  if (!row) return null;
  const { access_token_encrypted: token, ...rest } = row;
  return { ...rest, has_token: Boolean(token) };
}

async function load(supabase, workspaceId) {
  const [settings, channel, usage] = await Promise.all([
    supabase.from('ai_workspace_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    supabase.from('ai_channels').select(CHANNEL_PUBLIC).eq('workspace_id', workspaceId).eq('provider', 'meta_cloud').maybeSingle(),
    supabase.rpc('ai_usage_summary', { p_workspace_id: workspaceId }),
  ]);
  const flags = readGlobalAiFlags();
  return {
    settings: settings.data || { workspace_id: workspaceId, ai_enabled: false, mode: 'observe', assistant_name: 'Assistente virtual' },
    channel: publicChannel(channel.data),
    usage: (Array.isArray(usage.data) ? usage.data[0] : usage.data) || null,
    global: {
      kill_switch: flags.killSwitch,
      ai_enabled: flags.aiEnabled,
      llm_configured: Boolean(String(process.env.OPENAI_API_KEY || '').trim()),
      webhook_secret_configured: Boolean(String(process.env.META_APP_SECRET || '').trim()),
      verify_token_configured: Boolean(String(process.env.META_WEBHOOK_VERIFY_TOKEN || '').trim()),
      encryption_configured: Boolean(String(process.env.AI_CHANNEL_ENCRYPTION_KEY || '').trim()),
    },
  };
}

export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][SETTINGS]' });
  if (!guard.ok) return guard.response;
  return NextResponse.json({ ok: true, ...(await load(guard.supabase, guard.auth.workspaceId)) });
}

export async function PUT(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][SETTINGS][PUT]' });
  if (!guard.ok) return guard.response;
  const workspaceId = guard.auth.workspaceId;
  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  const settings = parseSettingsInput(body?.settings || {});
  if (Object.keys(settings).length) {
    const { error } = await guard.supabase.from('ai_workspace_settings')
      .upsert({ workspace_id: workspaceId, ...settings, updated_by: guard.auth.userId, updated_at: now }, { onConflict: 'workspace_id' });
    if (error) {
      console.error('[AI][SETTINGS][ERROR]', { code: error.code });
      return NextResponse.json({ ok: false, error: 'Falha ao salvar configurações.' }, { status: 500 });
    }
  }

  if (body?.channel) {
    const { fields, accessToken } = parseChannelInput(body.channel);
    if (accessToken) {
      try {
        fields.access_token_encrypted = await encryptSecret(accessToken);
      } catch {
        return NextResponse.json({ ok: false, error: 'Criptografia de credenciais não configurada no servidor.' }, { status: 503 });
      }
    }
    const { data: existing } = await guard.supabase.from('ai_channels').select('id, access_token_encrypted')
      .eq('workspace_id', workspaceId).eq('provider', 'meta_cloud').maybeSingle();
    if (fields.status === 'active' && !(fields.access_token_encrypted || existing?.access_token_encrypted)) {
      return NextResponse.json({ ok: false, error: 'Informe o token de acesso antes de ativar o canal.' }, { status: 400 });
    }
    const result = existing
      ? await guard.supabase.from('ai_channels').update({ ...fields, updated_at: now }).eq('id', existing.id)
      : fields.phone_number_id
        ? await guard.supabase.from('ai_channels').insert({ workspace_id: workspaceId, ...fields })
        : { error: { code: 'missing_phone_number_id' } };
    if (result.error) {
      const duplicate = result.error.code === '23505';
      return NextResponse.json({
        ok: false,
        error: duplicate ? 'Este número já está vinculado a outro workspace.' : 'Falha ao salvar canal (Phone Number ID obrigatório).',
      }, { status: duplicate ? 409 : 400 });
    }
  }

  return NextResponse.json({ ok: true, ...(await load(guard.supabase, workspaceId)) });
}
