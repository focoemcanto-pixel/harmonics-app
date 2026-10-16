/* Medição de uso por workspace (mensagens de WhatsApp enviadas, downloads de arquivos).
   O código já grava/lê public.usage_events (lib/usage/track-usage-event.js e a cota mensal de
   WhatsApp em lib/billing/check-workspace-plan-limit.js), mas a tabela nunca foi criada: com
   ENFORCE_WORKSPACE_PLANS=true todo envio de WhatsApp de plano com cota falharia, e sem ele a cota
   nunca é aplicada. Criação aditiva; acesso só pelo servidor (service_role), RLS sem policies. */
begin;
set local lock_timeout = '5s';
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null,
  quantity numeric not null default 1,
  unit text not null default 'count',
  entity_type text,
  entity_id text,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists usage_events_workspace_type_occurred_idx on public.usage_events (workspace_id, event_type, occurred_at desc);
alter table public.usage_events enable row level security;
revoke all on public.usage_events from anon, authenticated;
grant all on public.usage_events to service_role;
commit;
