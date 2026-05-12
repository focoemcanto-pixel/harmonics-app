-- File Access Audit
-- Objetivo:
-- registrar geração de signed URLs e acessos sensíveis por workspace.
--
-- Usado por:
-- - contratos PDF
-- - comprovantes de pagamento
-- - futuros anexos/repertórios

begin;

create table if not exists public.file_access_logs (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  entity_type text not null,
  entity_id uuid,

  bucket_id text,
  object_path text,

  access_type text not null default 'signed_url_generated',
  actor_user_id uuid,
  actor_role text,

  ip_address text,
  user_agent text,

  expires_in_seconds integer,
  status text not null default 'success',
  error_message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists file_access_logs_workspace_idx
  on public.file_access_logs(workspace_id, created_at desc);

create index if not exists file_access_logs_entity_idx
  on public.file_access_logs(entity_type, entity_id, created_at desc);

create index if not exists file_access_logs_status_idx
  on public.file_access_logs(status, created_at desc);

alter table public.file_access_logs enable row level security;

drop policy if exists "file_access_logs_workspace_admin_select" on public.file_access_logs;
create policy "file_access_logs_workspace_admin_select"
on public.file_access_logs
for select
to authenticated
using (current_user_is_workspace_admin(workspace_id));

drop policy if exists "file_access_logs_workspace_admin_insert" on public.file_access_logs;
create policy "file_access_logs_workspace_admin_insert"
on public.file_access_logs
for insert
to authenticated
with check (current_user_is_workspace_admin(workspace_id));

commit;

-- Consulta útil:
-- select entity_type, access_type, status, count(*)
-- from file_access_logs
-- group by entity_type, access_type, status
-- order by count(*) desc;
