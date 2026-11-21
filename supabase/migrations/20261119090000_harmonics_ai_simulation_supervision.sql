-- Separate from real conversations, contracts and the delivery queue.
create table if not exists public.ai_simulation_sessions (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null,
  revision integer not null default 0,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists ai_simulation_sessions_workspace_updated_idx
  on public.ai_simulation_sessions(workspace_id, updated_at desc);
alter table public.ai_simulation_sessions enable row level security;
revoke all on public.ai_simulation_sessions from public, anon, authenticated;
grant select, insert, update on public.ai_simulation_sessions to service_role;
