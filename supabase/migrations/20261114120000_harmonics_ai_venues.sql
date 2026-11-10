-- Memória permanente de espaços (chácaras, salões, igrejas...) usada pela Nara para classificar o local
-- sem pesquisar de novo. Homônimos convivem: a chave é nome normalizado + cidade normalizada + UF.
-- Só entradas "verified" são reutilizadas automaticamente; "client_reported" aguardam conferência do Owner.
create table if not exists public.ai_venues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  name_norm text not null,
  aliases text[] not null default '{}',
  address text,
  city text not null,
  city_norm text not null,
  uf text not null default 'BA' check (uf ~ '^[A-Z]{2}$'),
  lat numeric(9,6) check (lat is null or lat between -90 and 90),
  lng numeric(9,6) check (lng is null or lng between -180 and 180),
  area_id uuid references public.ai_service_areas(id) on delete set null,
  status text not null default 'client_reported' check (status in ('verified','client_reported','rejected')),
  source text not null check (source in ('owner','client_message','whatsapp_location','maps')),
  verified_at timestamptz,
  verified_by uuid,
  mentions integer not null default 1,
  last_conversation_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_venues_verified_has_date check (status <> 'verified' or verified_at is not null),
  unique (workspace_id, name_norm, city_norm, uf)
);
create index if not exists ai_venues_workspace_name_idx on public.ai_venues (workspace_id, name_norm);

alter table public.ai_venues enable row level security;
revoke all on public.ai_venues from anon, authenticated;
grant select, insert, update, delete on public.ai_venues to service_role;
