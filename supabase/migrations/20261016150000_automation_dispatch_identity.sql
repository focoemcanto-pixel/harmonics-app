-- Identidade e idempotência das automações que não são convite de escala.
-- Somente aditiva. Rollback: supabase/sql/20261016_automation_dispatch_identity.rollback.sql
--
-- 1) automation_logs.event_id referencia events.id. Contratos e pré-contratos passam a
--    ter colunas próprias (antes o ID deles ia para event_id e violava a FK).
alter table public.automation_logs
  add column if not exists precontract_id uuid references public.precontracts(id) on delete set null,
  add column if not exists contract_id uuid references public.contracts(id) on delete set null;

create index if not exists idx_automation_logs_precontract_id
  on public.automation_logs (precontract_id)
  where precontract_id is not null;

create index if not exists idx_automation_logs_contract_id
  on public.automation_logs (contract_id)
  where contract_id is not null;

-- 2) Reserva atômica de envio por chave de idempotência
--    (workspace + tipo + entidade correta + regra + etapa).
--    unique(workspace_id, dedupe_key) garante que cron concorrente, retry ou duplo
--    clique não enviem duas vezes. status: sending -> sent | failed (failed pode ser
--    reivindicado de novo por um retry; sending/sent nunca).
create table if not exists public.automation_dispatch_claims (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dedupe_key text not null,
  event_type text not null,
  rule_id uuid references public.automation_rules(id) on delete set null,
  entity_type text,
  entity_id text,
  status text not null check (status in ('sending', 'sent', 'failed')),
  log_id uuid references public.automation_logs(id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_dispatch_claims_workspace_key_unique unique (workspace_id, dedupe_key)
);

alter table public.automation_dispatch_claims enable row level security;
revoke all on public.automation_dispatch_claims from anon, authenticated;

notify pgrst, 'reload schema';
