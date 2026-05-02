import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { requireAdmin } from '@/lib/api/require-admin';

export async function GET(request) {
  const supabase = getSupabaseAdmin();
  const auth = await requireAdmin({ supabase, request, logPrefix: '[AUTOMATION_AI_CONFIG][GET]' });
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });

  const workspace = await getDefaultWorkspaceSettings(supabase);
  const { data, error } = await supabase
    .from('workspace_settings')
    .select('ai_enabled, ai_provider, ai_api_key, ai_model, ai_fallback_only, ai_monthly_limit')
    .eq('id', workspace.id)
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    config: {
      ai_enabled: Boolean(data?.ai_enabled),
      ai_provider: data?.ai_provider || 'openai',
      ai_model: data?.ai_model || 'gpt-4.1-mini',
      ai_fallback_only: data?.ai_fallback_only !== false,
      ai_monthly_limit: data?.ai_monthly_limit ?? null,
      hasApiKey: Boolean(String(data?.ai_api_key || '').trim()),
    },
  });
}

export async function PATCH(request) {
  const supabase = getSupabaseAdmin();
  const auth = await requireAdmin({ supabase, request, logPrefix: '[AUTOMATION_AI_CONFIG][PATCH]' });
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });

  const body = await request.json();
  const workspace = await getDefaultWorkspaceSettings(supabase);
  const patch = {
    ai_enabled: Boolean(body?.ai_enabled),
    ai_provider: 'openai',
    ai_model: String(body?.ai_model || 'gpt-4.1-mini').trim(),
    ai_fallback_only: body?.ai_fallback_only !== false,
    ai_monthly_limit: body?.ai_monthly_limit === null || body?.ai_monthly_limit === '' ? null : Number(body?.ai_monthly_limit || 0),
  };
  if (typeof body?.api_key === 'string' && body.api_key.trim()) patch.ai_api_key = body.api_key.trim();

  const { error } = await supabase.from('workspace_settings').update(patch).eq('id', workspace.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, hasApiKey: typeof patch.ai_api_key === 'string' ? true : undefined });
}
