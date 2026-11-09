-- Harmonics AI: gestão comercial de VOCALISTAS pela assistente (aditivo; não altera escalas, convites ou dados existentes).
--  - A assistente só gerencia vocalistas. Instrumentistas continuam com o assistente operacional.
--  - Todo convite/consulta a vocalista nasce como PEDIDO aguardando aprovação explícita do Owner.
--  - Nenhum envio automático: aprovar cria (ou reaproveita) o convite existente do Harmonics; o disparo
--    continua sendo manual pelo módulo de Convites.

-- 1) Perfil comercial do vocalista (ligado ao contato real do músico).
alter table public.ai_musician_profiles
  add column if not exists voice text,
  add column if not exists client_presentable boolean not null default false,
  add column if not exists presentation_urls text[] not null default '{}';
alter table public.ai_musician_profiles drop constraint if exists ai_musician_profiles_voice_check;
alter table public.ai_musician_profiles add constraint ai_musician_profiles_voice_check
  check (voice is null or voice in ('masculino', 'feminino'));

-- 2) Regras de prioridade (por contato) e tempos operacionais, configuráveis pelo Owner.
--    Ex.: {"duo_masculino":"<contact_id>","duo_feminino":"<contact_id>","reception_masculino":"<contact_id>","reception_feminino":"<contact_id>"}
alter table public.ai_workspace_settings
  add column if not exists vocalist_rules jsonb not null default '{}'::jsonb,
  add column if not exists arrival_minutes integer not null default 120,
  add column if not exists invite_response_days integer not null default 3;

-- 3) Pedidos de vocalista (consulta/convite) — sempre com aprovação do Owner.
create table if not exists public.ai_vocalist_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid,
  event_id uuid,
  precontract_id uuid,
  target_key text not null,              -- evento, pré-contrato ou conversa (escopo da duplicidade)
  contact_id uuid not null,              -- vocalista (contato real)
  voice text,
  reason text not null check (reason in ('priority_duo', 'priority_reception', 'client_choice', 'owner_choice', 'alternative')),
  status text not null default 'awaiting_approval' check (status in (
    'awaiting_approval', 'approved_waiting_event', 'invite_created', 'accepted', 'declined', 'expired',
    'conflict', 'rejected', 'cancelled', 'superseded')),
  event_date date not null,
  start_time time,
  duration_min integer,
  reception_hours integer not null default 0,
  formation text,
  location text,
  conflicts jsonb not null default '[]'::jsonb,
  invite_id uuid,
  approval_id uuid,
  decided_by uuid,
  decided_at timestamptz,
  responded_at timestamptz,
  notes text,
  -- Aprovação específica: músico + evento + data + horário + duração + receptivo + formação + local.
  -- Revalidada antes de qualquer disparo; mudança relevante => nova aprovação.
  approved_snapshot jsonb,
  replaces_request_id uuid references public.ai_vocalist_requests(id) on delete set null,
  created_by text not null default 'ai',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_vocalist_requests_ws_idx on public.ai_vocalist_requests (workspace_id, status, event_date);
create index if not exists ai_vocalist_requests_invite_idx on public.ai_vocalist_requests (invite_id) where invite_id is not null;
-- Sem pedido duplicado ativo para o mesmo vocalista no mesmo evento/pré-contrato/conversa.
create unique index if not exists ai_vocalist_requests_active_uq on public.ai_vocalist_requests (workspace_id, target_key, contact_id)
  where status in ('awaiting_approval', 'approved_waiting_event', 'invite_created', 'accepted', 'conflict');

-- 4) Auditoria (append-only).
create table if not exists public.ai_vocalist_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id uuid not null references public.ai_vocalist_requests(id) on delete cascade,
  action text not null,
  actor text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_vocalist_events_req_idx on public.ai_vocalist_events (request_id, created_at);

-- 5) Segurança: só o servidor (service_role) acessa.
alter table public.ai_vocalist_requests enable row level security;
alter table public.ai_vocalist_events enable row level security;
revoke all on public.ai_vocalist_requests from public, anon, authenticated;
revoke all on public.ai_vocalist_events from public, anon, authenticated;
