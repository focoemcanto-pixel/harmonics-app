-- Auditoria final de isolamento multi-tenant
-- Objetivo:
-- localizar registros sem workspace_id e validar cobertura.

-- 1. Tabelas críticas sem workspace_id preenchido.
select 'events' as table_name, count(*) as missing_workspace
from events
where workspace_id is null

union all

select 'contracts', count(*)
from contracts
where workspace_id is null

union all

select 'precontracts', count(*)
from precontracts
where workspace_id is null

union all

select 'payments', count(*)
from payments
where workspace_id is null

union all

select 'automation_logs', count(*)
from automation_logs
where workspace_id is null;

-- 2. Conferir políticas críticas.
select
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where tablename in (
  'events',
  'contracts',
  'precontracts',
  'payments',
  'automation_logs',
  'automation_rules',
  'contacts',
  'invites',
  'event_musicians',
  'repertoire_items',
  'repertoire_tokens'
)
order by tablename, policyname;

-- 3. Detectar possíveis assets públicos antigos.
select
  bucket_id,
  name,
  created_at
from storage.objects
where bucket_id in ('contract-pdfs', 'payment-proofs')
and name not like 'workspaces/%'
order by created_at desc
limit 200;

-- 4. Contratos sem vínculo de workspace.
select
  id,
  precontract_id,
  workspace_id,
  status,
  created_at
from contracts
where workspace_id is null
order by created_at desc
limit 100;

-- 5. Eventos sem vínculo de workspace.
select
  id,
  client_name,
  workspace_id,
  created_at
from events
where workspace_id is null
order by created_at desc
limit 100;
