create table if not exists public.finance_cost_defaults (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  musician_unit_cost numeric(12,2) not null default 0,
  sound_default_cost numeric(12,2) not null default 0,
  transport_default_cost numeric(12,2) not null default 0,
  other_default_cost numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finance_cost_defaults_slug
  on public.finance_cost_defaults (slug);

alter table public.events
  add column if not exists costs_source text;

insert into public.finance_cost_defaults (
  slug,
  musician_unit_cost,
  sound_default_cost,
  transport_default_cost,
  other_default_cost,
  notes
)
values ('default', 250, 350, 200, 0, null)
on conflict (slug) do nothing;
