alter table if exists public.scale_templates
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists source text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists scale_templates_workspace_active_idx
  on public.scale_templates (workspace_id, is_active, created_at desc);

create index if not exists scale_templates_onboarding_demo_idx
  on public.scale_templates (workspace_id, source)
  where source = 'onboarding_demo';
