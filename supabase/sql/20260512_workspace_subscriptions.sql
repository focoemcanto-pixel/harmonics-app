-- Workspace Subscriptions
-- Liga cada workspace ao plano atual do SaaS.
-- Depende de public.workspace_plans já existente.

begin;

create table if not exists public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_id uuid not null references public.workspace_plans(id) on delete restrict,

  status text not null default 'active',

  started_at timestamptz not null default now(),
  current_period_start timestamptz not null default date_trunc('month', now()),
  current_period_end timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,

  provider text,
  provider_customer_id text,
  provider_subscription_id text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workspace_subscriptions_status_check
    check (status in ('active', 'trialing', 'past_due', 'cancelled', 'expired', 'paused'))
);

create unique index if not exists workspace_subscriptions_one_active_idx
on public.workspace_subscriptions(workspace_id)
where status in ('active', 'trialing', 'past_due', 'paused');

create index if not exists workspace_subscriptions_workspace_idx
on public.workspace_subscriptions(workspace_id);

create index if not exists workspace_subscriptions_plan_idx
on public.workspace_subscriptions(plan_id);

create index if not exists workspace_subscriptions_status_idx
on public.workspace_subscriptions(status);

alter table public.workspace_subscriptions enable row level security;

drop policy if exists "workspace_subscriptions_workspace_admin_select" on public.workspace_subscriptions;
create policy "workspace_subscriptions_workspace_admin_select"
on public.workspace_subscriptions
for select
to authenticated
using (current_user_is_workspace_admin(workspace_id));

drop policy if exists "workspace_subscriptions_workspace_admin_insert" on public.workspace_subscriptions;
create policy "workspace_subscriptions_workspace_admin_insert"
on public.workspace_subscriptions
for insert
to authenticated
with check (current_user_is_workspace_admin(workspace_id));

drop policy if exists "workspace_subscriptions_workspace_admin_update" on public.workspace_subscriptions;
create policy "workspace_subscriptions_workspace_admin_update"
on public.workspace_subscriptions
for update
to authenticated
using (current_user_is_workspace_admin(workspace_id))
with check (current_user_is_workspace_admin(workspace_id));

commit;

-- Validação:
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
-- and table_name = 'workspace_subscriptions'
-- order by ordinal_position;
