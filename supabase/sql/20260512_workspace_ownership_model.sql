-- Workspace Ownership Model
-- Objetivo:
-- consolidar papéis tenant-aware para signup público e governança SaaS.
--
-- Roles oficiais:
-- - owner: dono do workspace, controla billing/plano/time
-- - admin: administra operação do workspace
-- - member: membro comum do workspace
--
-- Execute depois de criar workspace_subscriptions e planos.

begin;

-- 1. Garantir role padrão e constraint de papéis oficiais.
alter table public.workspace_members
  alter column role set default 'member';

-- Remove constraint antiga se houver, pois nomes podem variar entre migrations.
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.workspace_members'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.workspace_members drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'member'));

-- 2. Garantir unicidade usuário/workspace.
create unique index if not exists workspace_members_workspace_user_unique_idx
on public.workspace_members(workspace_id, user_id);

-- 3. Garantir no máximo um owner ativo por workspace.
-- Considera deleted_at se a coluna existir; se não existir, usa todos os registros.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workspace_members'
      and column_name = 'deleted_at'
  ) then
    execute '
      create unique index if not exists workspace_members_one_active_owner_idx
      on public.workspace_members(workspace_id)
      where role = ''owner'' and deleted_at is null
    ';
  else
    execute '
      create unique index if not exists workspace_members_one_owner_idx
      on public.workspace_members(workspace_id)
      where role = ''owner''
    ';
  end if;
end $$;

-- 4. Índices para resolução rápida.
create index if not exists workspace_members_user_idx
on public.workspace_members(user_id);

create index if not exists workspace_members_workspace_role_idx
on public.workspace_members(workspace_id, role);

-- 5. Backfill conservador: se workspace não tem owner, promove o membro mais antigo/admin.
do $$
declare
  row_workspace record;
  target_member_id uuid;
begin
  for row_workspace in
    select w.id
    from public.workspaces w
    where not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = w.id
        and wm.role = 'owner'
    )
  loop
    select wm.id into target_member_id
    from public.workspace_members wm
    where wm.workspace_id = row_workspace.id
    order by
      case when wm.role in ('admin', 'administrador') then 0 else 1 end,
      wm.created_at asc nulls last,
      wm.id asc
    limit 1;

    if target_member_id is not null then
      update public.workspace_members
      set role = 'owner'
      where id = target_member_id;
    end if;
  end loop;
end $$;

commit;

-- Validação:
-- select workspace_id, role, count(*)
-- from public.workspace_members
-- group by workspace_id, role
-- order by workspace_id, role;
