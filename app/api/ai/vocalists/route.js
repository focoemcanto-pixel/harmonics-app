import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { isWorkspaceOwner } from '@/lib/ai/commercial/owner.mjs';
import { vocalistPendencies } from '@/lib/ai/commercial/vocalists.mjs';

export const dynamic = 'force-dynamic';

// Central → Vocalistas: pendências (Owner) e escalas instrumentais incompletas (assistente operacional),
// pedidos de consulta/convite e auditoria. Somente leitura.
export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][VOCALISTS]' });
  if (!guard.ok) return guard.response;
  const ws = guard.auth.workspaceId;
  const { data: settings } = await guard.supabase.from('ai_workspace_settings').select('arrival_minutes, schedule_buffer_minutes, invite_response_days, vocalist_rules').eq('workspace_id', ws).maybeSingle();
  const [pendencies, requests, events] = await Promise.all([
    vocalistPendencies({ supabase: guard.supabase, workspaceId: ws, settings: settings || {} }),
    guard.supabase.from('ai_vocalist_requests').select('*').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(100),
    guard.supabase.from('ai_vocalist_events').select('request_id, action, actor, details, created_at').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(100),
  ]);
  return NextResponse.json({ ok: true, is_owner: isWorkspaceOwner(guard.auth), rules: settings?.vocalist_rules || {}, pendencies, requests: requests.data || [], audit: events.data || [] });
}
