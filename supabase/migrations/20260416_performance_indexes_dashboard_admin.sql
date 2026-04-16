-- Performance indexes for high-traffic admin dashboards and lists.
-- Safe: all indexes are additive and use IF NOT EXISTS.

create index if not exists idx_events_created_at_desc on public.events (created_at desc);
create index if not exists idx_events_event_date on public.events (event_date);
create index if not exists idx_events_status on public.events (status);

create index if not exists idx_precontracts_created_at_desc on public.precontracts (created_at desc);
create index if not exists idx_precontracts_status on public.precontracts (status);
create index if not exists idx_precontracts_event_id on public.precontracts (event_id);
create index if not exists idx_precontracts_public_token on public.precontracts (public_token);

create index if not exists idx_contracts_created_at_desc on public.contracts (created_at desc);
create index if not exists idx_contracts_status on public.contracts (status);
create index if not exists idx_contracts_event_id on public.contracts (event_id);
create index if not exists idx_contracts_precontract_id on public.contracts (precontract_id);
create index if not exists idx_contracts_public_token on public.contracts (public_token);

create index if not exists idx_event_musicians_created_at_desc on public.event_musicians (created_at desc);
create index if not exists idx_event_musicians_event_id on public.event_musicians (event_id);
create index if not exists idx_event_musicians_status on public.event_musicians (status);

create index if not exists idx_repertoire_config_created_at_desc on public.repertoire_config (created_at desc);
create index if not exists idx_repertoire_config_event_id on public.repertoire_config (event_id);
create index if not exists idx_repertoire_config_status on public.repertoire_config (status);

create index if not exists idx_contract_adjustment_requests_created_at_desc
  on public.contract_adjustment_requests (created_at desc);
create index if not exists idx_contract_adjustment_requests_precontract_id
  on public.contract_adjustment_requests (precontract_id);
create index if not exists idx_contract_adjustment_requests_status
  on public.contract_adjustment_requests (status);
