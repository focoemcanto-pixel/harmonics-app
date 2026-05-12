-- Usage & Billing Foundation
-- Objetivo:
-- registrar consumo por workspace para planos SaaS, limites, billing e analytics.
--
-- Exemplos de eventos:
-- - contract_generated
-- - whatsapp_message_sent
-- - file_downloaded
-- - payment_proof_uploaded
-- - event_created
-- - storage_asset_migrated

begin;

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  event_type text not null,
  quantity numeric not null default 1,
  unit text not null default 'count',

  entity_type text,
  entity_id uuid,

  source text,
  metadata jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists usage_events_workspace_time_idx
  on public.usage_events(workspace_id, occurred_at desc);

create index if not exists usage_events_type_time_idx
  on public.usage_events(event_type, occurred_at desc);

create index if not exists usage_events_entity_idx
  on public.usage_events(entity_type, entity_id);

alter table public.usage_events enable row level security;

drop policy if exists "usage_events_workspace_admin_select" on public.usage_events;
create policy "usage_events_workspace_admin_select"
on public.usage_events
for select
to authenticated
using (current_user_is_workspace_admin(workspace_id));

drop policy if exists "usage_events_workspace_admin_insert" on public.usage_events;
create policy "usage_events_workspace_admin_insert"
on public.usage_events
for insert
to authenticated
with check (current_user_is_workspace_admin(workspace_id));

commit;

-- Consulta mensal sugerida:
-- select
--   workspace_id,
--   event_type,
--   date_trunc('month', occurred_at) as month,
--   sum(quantity) as total
-- from usage_events
-- group by workspace_id, event_type, date_trunc('month', occurred_at)
-- order by month desc, event_type;
