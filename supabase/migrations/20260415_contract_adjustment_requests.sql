create table if not exists public.contract_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  precontract_id uuid not null references public.precontracts (id) on delete cascade,
  contract_id uuid references public.contracts (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  client_public_token text,
  request_message text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'cancelled')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contract_adjustment_requests_precontract_status_idx
  on public.contract_adjustment_requests (precontract_id, status, requested_at desc);

create index if not exists contract_adjustment_requests_event_status_idx
  on public.contract_adjustment_requests (event_id, status, requested_at desc);
