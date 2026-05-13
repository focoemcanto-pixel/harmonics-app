alter table if exists public.contract_templates
add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

create index if not exists contract_templates_workspace_id_idx
on public.contract_templates(workspace_id);

create unique index if not exists contract_templates_workspace_slug_unique_idx
on public.contract_templates(workspace_id, slug)
where workspace_id is not null;
