create table if not exists public.finance_cost_defaults (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null default 'default',
  musician_unit_cost numeric(12,2) not null default 0,
  sound_default_cost numeric(12,2) not null default 0,
  transport_default_cost numeric(12,2) not null default 0,
  other_default_cost numeric(12,2) not null default 0,
  custom_costs jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.finance_cost_defaults
  alter column slug set default 'default',
  alter column musician_unit_cost set default 0,
  alter column sound_default_cost set default 0,
  alter column transport_default_cost set default 0,
  alter column other_default_cost set default 0,
  alter column custom_costs set default '[]'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.finance_cost_defaults
set
  slug = coalesce(nullif(slug, ''), 'default'),
  musician_unit_cost = coalesce(musician_unit_cost, 0),
  sound_default_cost = coalesce(sound_default_cost, 0),
  transport_default_cost = coalesce(transport_default_cost, 0),
  other_default_cost = coalesce(other_default_cost, 0),
  custom_costs = coalesce(custom_costs, '[]'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where
  slug is null
  or slug = ''
  or musician_unit_cost is null
  or sound_default_cost is null
  or transport_default_cost is null
  or other_default_cost is null
  or custom_costs is null
  or created_at is null
  or updated_at is null;

alter table if exists public.finance_cost_defaults
  alter column slug set not null,
  alter column musician_unit_cost set not null,
  alter column sound_default_cost set not null,
  alter column transport_default_cost set not null,
  alter column other_default_cost set not null,
  alter column custom_costs set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

insert into public.finance_cost_defaults (slug)
values ('default')
on conflict (slug) do nothing;
