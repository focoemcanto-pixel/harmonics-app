-- Backfill seguro de workspace_id para dados legados
-- Execute após revisar o resultado de 20260512_workspace_isolation_audit.sql.
-- Este script NÃO apaga dados.
-- Ele tenta preencher workspace_id usando relacionamentos confiáveis.

begin;

-- 1. Precontracts: herdar workspace do evento quando houver event_id.
update precontracts p
set workspace_id = e.workspace_id
from events e
where p.workspace_id is null
  and p.event_id = e.id
  and e.workspace_id is not null;

-- 2. Contracts: herdar workspace do precontract.
update contracts c
set workspace_id = p.workspace_id
from precontracts p
where c.workspace_id is null
  and c.precontract_id = p.id
  and p.workspace_id is not null;

-- 3. Contracts: fallback por event_id, quando existir.
update contracts c
set workspace_id = e.workspace_id
from events e
where c.workspace_id is null
  and c.event_id = e.id
  and e.workspace_id is not null;

-- 4. Payments: herdar workspace do evento.
update payments pay
set workspace_id = e.workspace_id
from events e
where pay.workspace_id is null
  and pay.event_id = e.id
  and e.workspace_id is not null;

-- 5. Automation logs: herdar workspace do evento quando houver event_id.
update automation_logs l
set workspace_id = e.workspace_id
from events e
where l.workspace_id is null
  and l.event_id = e.id
  and e.workspace_id is not null;

-- 6. Automation logs: herdar workspace da regra quando houver rule_id.
update automation_logs l
set workspace_id = r.workspace_id
from automation_rules r
where l.workspace_id is null
  and l.rule_id = r.id
  and r.workspace_id is not null;

-- 7. Invites: não possuem workspace_id direto em algumas versões.
-- O isolamento é via events.workspace_id nas policies. Sem ação necessária.

commit;

-- Validação pós-backfill:
select 'events' as table_name, count(*) as missing_workspace
from events
where workspace_id is null

union all
select 'precontracts', count(*) from precontracts where workspace_id is null

union all
select 'contracts', count(*) from contracts where workspace_id is null

union all
select 'payments', count(*) from payments where workspace_id is null

union all
select 'automation_logs', count(*) from automation_logs where workspace_id is null;
