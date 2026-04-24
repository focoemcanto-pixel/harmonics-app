alter table if exists public.pricing_settings
  add column if not exists musician_unit_cost numeric(12,2) default 0,
  add column if not exists sound_default_cost numeric(12,2) default 0,
  add column if not exists transport_default_cost numeric(12,2) default 0,
  add column if not exists other_default_cost numeric(12,2) default 0,
  add column if not exists finance_notes text;

alter table if exists public.events
  add column if not exists other_cost numeric(12,2) not null default 0;
