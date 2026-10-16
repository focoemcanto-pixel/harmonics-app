-- Rollback de supabase/migrations/20261016150000_automation_dispatch_identity.sql
-- Reverter o código antes: o código anterior não usa estas colunas/tabela
-- (o insert de log remove colunas inexistentes automaticamente).
-- Atenção: apaga o histórico de reservas de envio (idempotência) das automações.

drop table if exists public.automation_dispatch_claims;

drop index if exists public.idx_automation_logs_contract_id;
drop index if exists public.idx_automation_logs_precontract_id;
alter table public.automation_logs
  drop column if exists contract_id,
  drop column if exists precontract_id;

notify pgrst, 'reload schema';
