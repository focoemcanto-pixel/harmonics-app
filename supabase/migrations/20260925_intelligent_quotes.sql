-- Harmonics intelligent quoting core
create table if not exists public.quote_price_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  category text not null check (category in ('ceremony','reception','sound','transport','musician_fee','other')),
  item_key text not null,
  label text not null,
  amount numeric(12,2) not null default 0,
  valid_from date not null,
  valid_until date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from)
);
create index if not exists quote_price_rules_lookup_idx on public.quote_price_rules(workspace_id, category, item_key, valid_from desc);

create table if not exists public.quote_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null,
  city text,
  state text,
  address text,
  distance_km numeric(10,2),
  travel_minutes integer,
  round_trip_cost numeric(12,2),
  toll_cost numeric(12,2),
  parking_cost numeric(12,2),
  overnight_likely boolean not null default false,
  notes text,
  source text not null default 'manual',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_locations_workspace_name_idx on public.quote_locations(workspace_id, lower(name));

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  status text not null default 'draft' check (status in ('draft','sent','approved','rejected','expired')),
  client_name text,
  client_phone text,
  client_email text,
  event_type text default 'Casamento',
  event_date date,
  event_time time,
  location_name text,
  location_address text,
  formation text,
  instruments text,
  reception_hours numeric(5,2) not null default 0,
  reception_formation text,
  has_sound boolean not null default false,
  base_amount numeric(12,2) not null default 0,
  reception_amount numeric(12,2) not null default 0,
  sound_amount numeric(12,2) not null default 0,
  logistics_amount numeric(12,2) not null default 0,
  suggested_amount numeric(12,2) not null default 0,
  agreed_amount numeric(12,2),
  logistics_snapshot jsonb not null default '{}'::jsonb,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  analysis text,
  notes text,
  precontract_id uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quotes_workspace_created_idx on public.quotes(workspace_id, created_at desc);

alter table public.quote_price_rules enable row level security;
alter table public.quote_locations enable row level security;
alter table public.quotes enable row level security;

do $$ begin
  create policy "workspace quote price rules" on public.quote_price_rules for all using (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  ) with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "workspace quote locations" on public.quote_locations for all using (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  ) with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "workspace quotes" on public.quotes for all using (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  ) with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));
exception when duplicate_object then null; end $$;
