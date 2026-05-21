begin;

alter table if exists public.profiles
  add column if not exists migrated_from_pms boolean not null default false,
  add column if not exists migration_completed_at timestamptz;

alter table if exists public.workspace_subscriptions
  add column if not exists migrated_from_pms boolean not null default false,
  add column if not exists original_gateway text,
  add column if not exists imported_at timestamptz;

create table if not exists public.migration_logs (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists migration_logs_email_idx on public.migration_logs(email);
create index if not exists migration_logs_status_idx on public.migration_logs(status);

commit;
