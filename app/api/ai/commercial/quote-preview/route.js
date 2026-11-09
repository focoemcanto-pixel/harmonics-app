import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { quoteForWorkspace } from '@/lib/ai/commercial/pricing.mjs';
import { checkPrimaryVocal } from '@/lib/ai/commercial/schedule.mjs';
import { createRouteFn } from '@/lib/logistics/google-distance.mjs';

export const dynamic = 'force-dynamic';

// Simulador do painel: mostra exatamente o que a IA calcularia (somente leitura).
export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][QUOTE_PREVIEW]' });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => ({}));
  const ws = guard.auth.workspaceId;
  const { data: settings } = await guard.supabase.from('ai_workspace_settings').select('*').eq('workspace_id', ws).maybeSingle();
  const input = {
    date: body.date, formation: body.formation, instruments: body.instruments || '', hasSound: Boolean(body.hasSound),
    reception: { formation: body.receptionFormation || null, hours: Number(body.receptionHours || 0), instruments: body.receptionInstruments || '' },
    location: body.location || null,
    modality: body.modality === 'show' ? 'show' : 'ceremony', hours: Number(body.hours || 0) || null,
  };
  const quote = await quoteForWorkspace({ supabase: guard.supabase, workspaceId: ws, input, settings, routeFn: createRouteFn() });
  const vocal = body.date ? await checkPrimaryVocal({ supabase: guard.supabase, workspaceId: ws, request: { date: body.date, time: body.time, durationMin: 60, bufferMin: settings?.schedule_buffer_minutes } }) : null;
  return NextResponse.json({ ok: true, quote, vocal });
}
