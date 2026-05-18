alter table if exists public.contacts
  add column if not exists source text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists contacts_workspace_source_idx
  on public.contacts (workspace_id, source)
  where source is not null;

create index if not exists contacts_onboarding_demo_metadata_idx
  on public.contacts (workspace_id)
  where (metadata ->> 'is_onboarding_demo') = 'true';
