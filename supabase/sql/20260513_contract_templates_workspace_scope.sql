-- 20260513_contract_templates_workspace_scope.sql
-- Objetivo: impedir que templates de contrato e tipos de evento vazem entre workspaces.
-- Execute no SQL Editor do Supabase antes de testar novos workspaces.

begin;

-- 1. Tornar templates tenant-aware.
alter table public.contract_templates
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

create index if not exists contract_templates_workspace_id_idx
  on public.contract_templates(workspace_id);

-- 2. Tornar tipos de evento tenant-aware, se ainda não forem.
alter table public.event_types
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

create index if not exists event_types_workspace_id_idx
  on public.event_types(workspace_id);

-- 3. Evitar que um workspace novo enxergue templates globais antigos.
-- Importante: os templates antigos ficam preservados, mas sem workspace_id.
-- O app novo deve listar apenas templates do workspace atual.

-- 4. RLS conservador para leitura por membership.
alter table public.contract_templates enable row level security;
alter table public.event_types enable row level security;

drop policy if exists "Authenticated users can read active templates" on public.contract_templates;
drop policy if exists "Admins can do everything on templates" on public.contract_templates;

create policy "Workspace members can read contract templates"
  on public.contract_templates
  for select
  to authenticated
  using (
    workspace_id is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = contract_templates.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

create policy "Workspace admins can manage contract templates"
  on public.contract_templates
  for all
  to authenticated
  using (
    workspace_id is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = contract_templates.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
        and lower(wm.role) in ('owner', 'admin', 'administrador')
    )
  )
  with check (
    workspace_id is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = contract_templates.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
        and lower(wm.role) in ('owner', 'admin', 'administrador')
    )
  );

-- Policies de event_types podem já existir. Criamos nomes específicos e seguros.
drop policy if exists "Workspace members can read event types" on public.event_types;
drop policy if exists "Workspace admins can manage event types" on public.event_types;

create policy "Workspace members can read event types"
  on public.event_types
  for select
  to authenticated
  using (
    workspace_id is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = event_types.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

create policy "Workspace admins can manage event types"
  on public.event_types
  for all
  to authenticated
  using (
    workspace_id is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = event_types.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
        and lower(wm.role) in ('owner', 'admin', 'administrador')
    )
  )
  with check (
    workspace_id is not null
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = event_types.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
        and lower(wm.role) in ('owner', 'admin', 'administrador')
    )
  );

commit;

-- Validação rápida:
-- select id, name, workspace_id from public.contract_templates order by created_at desc limit 20;
-- select id, name, workspace_id from public.event_types order by created_at desc limit 20;
