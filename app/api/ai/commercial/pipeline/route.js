import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { summarizePipeline } from '@/lib/ai/commercial/metrics.mjs';

export const dynamic = 'force-dynamic';

// CRM (etapas, objeções, perdas), remarketing, qualidade e custos — últimos N dias.
export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][PIPELINE]' });
  if (!guard.ok) return guard.response;
  const ws = guard.auth.workspaceId;
  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get('days')) || 30, 1), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const db = guard.supabase;
  const [conv, events, fu, usage, outbox, approvals] = await Promise.all([
    db.from('ai_conversations').select('id, contact_name, provider_chat_id, sales_stage, objections, lost_reason, deal_value, needs_human, last_message_at, last_inbound_at, opted_out').eq('workspace_id', ws).gte('updated_at', since).limit(1000),
    db.from('ai_stage_events').select('to_stage, created_at').eq('workspace_id', ws).gte('created_at', since).limit(5000),
    db.from('ai_followups').select('id, conversation_id, step, status, due_at, updated_at, cancel_reason').eq('workspace_id', ws).gte('created_at', since).limit(5000),
    db.from('ai_usage_ledger').select('kind, input_tokens, output_tokens, cost_usd').eq('workspace_id', ws).gte('created_at', since).limit(10000),
    db.from('ai_message_outbox').select('sender_type, status, last_error').eq('workspace_id', ws).gte('created_at', since).limit(10000),
    db.from('ai_approvals').select('id, kind, summary, status, conversation_id, created_at').eq('workspace_id', ws).gte('created_at', since).order('created_at', { ascending: false }).limit(200),
  ]);
  const conversations = conv.data || [];
  const lastInbound = new Map(conversations.map((c) => [c.id, c.last_inbound_at]));
  const followups = (fu.data || []).map((f) => ({ ...f, recovered: f.status === 'sent' && lastInbound.get(f.conversation_id) && lastInbound.get(f.conversation_id) > f.updated_at }));
  const metrics = summarizePipeline({ conversations, stageEvents: events.data || [], followups, usage: usage.data || [], outbox: outbox.data || [], approvals: approvals.data || [] });
  return NextResponse.json({
    ok: true, days, metrics,
    deals: conversations.filter((c) => !['new'].includes(c.sales_stage)).slice(0, 200)
      .map(({ provider_chat_id: chat, ...c }) => ({ ...c, phone_tail: String(chat || '').slice(-4) })),
    approvals: approvals.data || [],
    followups: followups.filter((f) => f.status === 'scheduled').slice(0, 100),
  });
}
