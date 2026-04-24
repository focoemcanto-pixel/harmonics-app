alter table public.finance_cost_defaults
add column if not exists custom_costs jsonb default '[]'::jsonb;

alter table public.events
add column if not exists cost_breakdown jsonb default '[]'::jsonb,
add column if not exists costs_source text default 'manual';
