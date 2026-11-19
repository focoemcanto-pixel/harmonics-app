-- Only server-side, authenticated application routes can access geographic evidence.
-- The simulator and the live application use separate cache namespaces.
create table public.ai_geo_cache (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scope text not null check (scope in ('simulation', 'live')),
  lookup_key text not null check (length(lookup_key) = 64),
  evidence jsonb not null,
  status text not null,
  expires_at timestamptz not null,
  primary key (workspace_id, scope, lookup_key)
);

create index ai_geo_cache_expiry_idx on public.ai_geo_cache (expires_at);
alter table public.ai_geo_cache enable row level security;
revoke all on public.ai_geo_cache from public, anon, authenticated;
grant select, insert, update, delete on public.ai_geo_cache to service_role;
