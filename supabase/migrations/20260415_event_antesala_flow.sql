alter table public.events
  add column if not exists has_antesala boolean not null default false,
  add column if not exists antesala_duration_minutes integer,
  add column if not exists antesala_requested_by_client boolean not null default false,
  add column if not exists antesala_request_status text,
  add column if not exists antesala_price_increment numeric(10,2);

create index if not exists idx_events_antesala_requested
  on public.events (antesala_requested_by_client, antesala_request_status);
