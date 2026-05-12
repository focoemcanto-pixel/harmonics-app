-- Workspace Enforcement Phase 1
-- Execute SOMENTE depois de rodar:
-- 1) 20260512_workspace_isolation_audit.sql
-- 2) 20260512_workspace_backfill_safe.sql
--
-- Objetivo:
-- impedir que novos registros críticos sejam criados sem workspace_id.
-- Este script é conservador: valida antes de aplicar NOT NULL.

begin;

-- 1. Falhar cedo se ainda houver registros órfãos.
do $$
declare
  missing_events int;
  missing_precontracts int;
  missing_contracts int;
  missing_payments int;
  missing_logs int;
begin
  select count(*) into missing_events from events where workspace_id is null;
  select count(*) into missing_precontracts from precontracts where workspace_id is null;
  select count(*) into missing_contracts from contracts where workspace_id is null;
  select count(*) into missing_payments from payments where workspace_id is null;
  select count(*) into missing_logs from automation_logs where workspace_id is null;

  if missing_events > 0
    or missing_precontracts > 0
    or missing_contracts > 0
    or missing_payments > 0
    or missing_logs > 0 then
    raise exception
      'workspace enforcement bloqueado: existem registros sem workspace_id. events=%, precontracts=%, contracts=%, payments=%, automation_logs=%',
      missing_events,
      missing_precontracts,
      missing_contracts,
      missing_payments,
      missing_logs;
  end if;
end $$;

-- 2. Tornar workspace_id obrigatório nas tabelas críticas.
alter table events alter column workspace_id set not null;
alter table precontracts alter column workspace_id set not null;
alter table contracts alter column workspace_id set not null;
alter table payments alter column workspace_id set not null;
alter table automation_logs alter column workspace_id set not null;

-- 3. Garantir FKs para public.workspaces(id), quando ainda não existirem.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_workspace_id_fkey'
  ) then
    alter table events
      add constraint events_workspace_id_fkey
      foreign key (workspace_id) references workspaces(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'precontracts_workspace_id_fkey'
  ) then
    alter table precontracts
      add constraint precontracts_workspace_id_fkey
      foreign key (workspace_id) references workspaces(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contracts_workspace_id_fkey'
  ) then
    alter table contracts
      add constraint contracts_workspace_id_fkey
      foreign key (workspace_id) references workspaces(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payments_workspace_id_fkey'
  ) then
    alter table payments
      add constraint payments_workspace_id_fkey
      foreign key (workspace_id) references workspaces(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'automation_logs_workspace_id_fkey'
  ) then
    alter table automation_logs
      add constraint automation_logs_workspace_id_fkey
      foreign key (workspace_id) references workspaces(id) on delete restrict;
  end if;
end $$;

-- 4. Índices úteis para performance e isolamento.
create index if not exists events_workspace_id_idx on events(workspace_id);
create index if not exists precontracts_workspace_id_idx on precontracts(workspace_id);
create index if not exists contracts_workspace_id_idx on contracts(workspace_id);
create index if not exists payments_workspace_id_idx on payments(workspace_id);
create index if not exists automation_logs_workspace_id_idx on automation_logs(workspace_id);

-- 5. Validação final.
do $$
declare
  missing_total int;
begin
  select
    (select count(*) from events where workspace_id is null) +
    (select count(*) from precontracts where workspace_id is null) +
    (select count(*) from contracts where workspace_id is null) +
    (select count(*) from payments where workspace_id is null) +
    (select count(*) from automation_logs where workspace_id is null)
  into missing_total;

  if missing_total > 0 then
    raise exception 'workspace enforcement falhou: ainda existem % registros sem workspace_id', missing_total;
  end if;
end $$;

commit;

-- Pós-validação:
-- select table_name, column_name, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
-- and table_name in ('events','precontracts','contracts','payments','automation_logs')
-- and column_name = 'workspace_id'
-- order by table_name;
