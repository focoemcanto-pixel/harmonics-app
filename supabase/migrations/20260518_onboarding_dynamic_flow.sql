alter table if exists public.workspace_onboarding_progress
  add column if not exists flow_state jsonb not null default '{}'::jsonb;

alter table if exists public.events
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists source text,
  add column if not exists is_demo boolean not null default false;

create index if not exists idx_events_onboarding_demo_workspace
  on public.events (workspace_id, created_at desc)
  where is_demo = true or source = 'onboarding_demo' or (metadata->>'is_onboarding_demo') = 'true';


alter table if exists public.precontracts
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists source text,
  add column if not exists is_demo boolean not null default false;
