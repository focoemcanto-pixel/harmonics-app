create table if not exists public.automation_cron_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  status text not null check (status in ('completed', 'completed_with_failures', 'failed')),
  total_rules integer not null default 0,
  total_eligible integer not null default 0,
  total_executions integer not null default 0,
  total_sent integer not null default 0,
  total_skipped integer not null default 0,
  total_failed integer not null default 0,
  error_message text null,
  payload jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists automation_cron_runs_workspace_started_idx
  on public.automation_cron_runs (workspace_id, started_at desc);

create index if not exists automation_cron_runs_started_idx
  on public.automation_cron_runs (started_at desc);
