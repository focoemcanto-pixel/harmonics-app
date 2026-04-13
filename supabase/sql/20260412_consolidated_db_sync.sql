-- Consolidated DB sync for automation, escala/templates, and recent repertoire/oauth updates
-- Safe/idempotent script for Supabase PostgreSQL.

create extension if not exists pgcrypto;

-- =====================================================
-- A) AUTOMAÇÃO
-- =====================================================

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.workspaces (key, name, is_active)
select 'default', 'Workspace padrão', true
where not exists (select 1 from public.workspaces where key = 'default');

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspace_settings(id) on delete set null,
  key text not null,
  name text not null,
  channel text not null default 'whatsapp',
  recipient_type text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists message_templates_workspace_key_uniq_idx
  on public.message_templates (workspace_id, key);

create index if not exists message_templates_workspace_active_idx
  on public.message_templates (workspace_id, is_active);

create table if not exists public.whatsapp_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspace_settings(id) on delete set null,
  name text not null,
  provider text not null default 'wasender',
  api_url text null,
  api_key text null,
  instance_id text null,
  sender_number text null,
  admin_alert_number text null,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_channels_single_default_per_workspace_idx
  on public.whatsapp_channels (workspace_id)
  where is_default = true;

create index if not exists whatsapp_channels_workspace_active_idx
  on public.whatsapp_channels (workspace_id, is_active);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspace_settings(id) on delete set null,
  key text not null,
  name text not null,
  event_type text not null,
  recipient_type text not null,
  template_id uuid null references public.message_templates(id) on delete set null,
  channel_id uuid null references public.whatsapp_channels(id) on delete set null,
  days_before integer null,
  days_after integer null,
  send_time time null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists automation_rules_workspace_key_uniq_idx
  on public.automation_rules (workspace_id, key);

create index if not exists automation_rules_workspace_event_active_idx
  on public.automation_rules (workspace_id, event_type, is_active);

create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspace_settings(id) on delete set null,
  rule_id uuid null references public.automation_rules(id) on delete set null,
  template_id uuid null references public.message_templates(id) on delete set null,
  channel_id uuid null references public.whatsapp_channels(id) on delete set null,
  entity_id text null,
  entity_type text null,
  recipient_type text null,
  recipient text null,
  recipient_number text null,
  rendered_message text null,
  metadata jsonb null,
  provider_response jsonb null,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  error_message text null,
  source text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table if exists public.automation_logs
  add column if not exists workspace_id uuid,
  add column if not exists rule_id uuid,
  add column if not exists template_id uuid,
  add column if not exists channel_id uuid,
  add column if not exists entity_id text,
  add column if not exists entity_type text,
  add column if not exists recipient_type text,
  add column if not exists recipient text,
  add column if not exists recipient_number text,
  add column if not exists rendered_message text,
  add column if not exists metadata jsonb,
  add column if not exists provider_response jsonb,
  add column if not exists status text,
  add column if not exists error_message text,
  add column if not exists source text,
  add column if not exists sent_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

update public.automation_logs
set recipient_number = coalesce(nullif(trim(recipient_number), ''), nullif(trim(recipient), ''))
where coalesce(nullif(trim(recipient_number), ''), '') = ''
  and coalesce(nullif(trim(recipient), ''), '') <> '';

update public.automation_logs
set recipient = coalesce(nullif(trim(recipient), ''), nullif(trim(recipient_number), ''))
where coalesce(nullif(trim(recipient), ''), '') = ''
  and coalesce(nullif(trim(recipient_number), ''), '') <> '';

create or replace function public.sync_automation_log_recipient_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(nullif(trim(new.recipient_number), ''), '') = '' then
    new.recipient_number := nullif(trim(new.recipient), '');
  end if;

  if coalesce(nullif(trim(new.recipient), ''), '') = '' then
    new.recipient := nullif(trim(new.recipient_number), '');
  end if;

  if new.sent_at is null and new.status = 'sent' then
    new.sent_at := now();
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_sync_automation_log_recipient_fields'
  ) then
    create trigger trg_sync_automation_log_recipient_fields
    before insert or update on public.automation_logs
    for each row
    execute function public.sync_automation_log_recipient_fields();
  end if;
end $$;

create index if not exists automation_logs_workspace_created_idx
  on public.automation_logs (workspace_id, created_at desc);

create index if not exists automation_logs_status_created_idx
  on public.automation_logs (status, created_at desc);

create index if not exists automation_logs_rule_created_idx
  on public.automation_logs (rule_id, created_at desc);

create index if not exists automation_logs_recipient_number_idx
  on public.automation_logs (recipient_number);

create table if not exists public.automation_cron_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspace_settings(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  status text not null check (status in ('completed', 'completed_with_failures', 'failed')),
  total_rules integer not null default 0,
  total_eligible integer not null default 0,
  total_executions integer not null default 0,
  total_sent integer not null default 0,
  total_skipped integer not null default 0,
  total_failed integer not null default 0,
  error_message text null,
  payload jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists automation_cron_runs_workspace_started_idx
  on public.automation_cron_runs (workspace_id, started_at desc);

create index if not exists automation_cron_runs_started_idx
  on public.automation_cron_runs (started_at desc);

-- =====================================================
-- B) ESCALA / TEMPLATES
-- =====================================================

create table if not exists public.scale_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  formation text not null,
  instruments text null,
  compatible_tags text null,
  suggestion_priority integer not null default 100,
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.scale_templates
  add column if not exists compatible_tags text,
  add column if not exists suggestion_priority integer not null default 100,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

-- Normalização opcional para tags em array (sem quebrar o campo texto usado pelo frontend atual)
alter table if exists public.scale_templates
  add column if not exists compatible_tags_arr text[];

update public.scale_templates
set compatible_tags_arr = string_to_array(regexp_replace(coalesce(compatible_tags, ''), '\\s+', '', 'g'), ',')
where compatible_tags_arr is null
  and coalesce(trim(compatible_tags), '') <> '';

create index if not exists scale_templates_active_formation_priority_idx
  on public.scale_templates (is_active, formation, suggestion_priority);

create table if not exists public.scale_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.scale_templates(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  role text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.scale_template_items
  add column if not exists role text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists scale_template_items_template_sort_idx
  on public.scale_template_items (template_id, sort_order);

create index if not exists scale_template_items_contact_idx
  on public.scale_template_items (contact_id);

create table if not exists public.event_musicians (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  musician_id uuid not null references public.contacts(id) on delete cascade,
  role text null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'backup', 'removed')),
  notes text null,
  confirmed_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.event_musicians
  add column if not exists role text,
  add column if not exists status text,
  add column if not exists notes text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.event_musicians
set status = coalesce(nullif(trim(status), ''), 'pending')
where status is null or trim(status) = '';

create unique index if not exists event_musicians_event_musician_unique_idx
  on public.event_musicians (event_id, musician_id);

create index if not exists event_musicians_event_status_idx
  on public.event_musicians (event_id, status);

create index if not exists event_musicians_musician_idx
  on public.event_musicians (musician_id);

-- =====================================================
-- C) EVENTOS / CONTRATOS / OUTROS (mudanças recentes)
-- =====================================================

create table if not exists public.google_oauth_credentials (
  provider text primary key,
  credentials jsonb not null,
  is_active boolean not null default true,
  user_id text null,
  status text not null default 'valid',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table if exists public.google_oauth_credentials
  add column if not exists user_id text,
  add column if not exists status text not null default 'valid';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'unique_user_credentials'
      and conrelid = 'public.google_oauth_credentials'::regclass
  ) then
    alter table public.google_oauth_credentials
      add constraint unique_user_credentials unique (user_id);
  end if;
end $$;

update public.google_oauth_credentials
set credentials = (trim(both '"' from credentials::text))::jsonb,
    updated_at = timezone('utc'::text, now())
where jsonb_typeof(credentials) = 'string'
  and trim(both '"' from credentials::text) like '{%}';

update public.google_oauth_credentials
set credentials = jsonb_set(
      credentials,
      '{refresh_token}',
      to_jsonb(trim(credentials#>>'{tokens,refresh_token}')),
      true
    ),
    updated_at = timezone('utc'::text, now())
where jsonb_typeof(credentials) = 'object'
  and coalesce(trim(credentials->>'refresh_token'), '') = ''
  and coalesce(trim(credentials#>>'{tokens,refresh_token}'), '') <> '';

alter table if exists public.repertoire_config
  add column if not exists repertoire_pdf_url text,
  add column if not exists client_public_token text,
  add column if not exists reminder_15d_whatsapp_sent_at timestamptz,
  add column if not exists exit_reference_title text,
  add column if not exists exit_reference_channel text,
  add column if not exists exit_reference_thumbnail text,
  add column if not exists exit_reference_video_id text;

alter table if exists public.repertoire_items
  add column if not exists reference_title text,
  add column if not exists reference_channel text,
  add column if not exists reference_thumbnail text,
  add column if not exists reference_video_id text;

create index if not exists repertoire_config_event_id_idx
  on public.repertoire_config (event_id);

create index if not exists repertoire_config_reminder_15d_idx
  on public.repertoire_config (reminder_15d_whatsapp_sent_at);

create index if not exists repertoire_items_event_order_idx
  on public.repertoire_items (event_id, item_order);

-- =====================================================
-- RLS (mínimo, sem políticas complexas para não quebrar fluxo atual)
-- =====================================================

-- Atenção: as rotas atuais usam majoritariamente service_role (backend).
-- Se o acesso direto via client-side às tabelas abaixo for necessário com RLS ativo,
-- criar policies específicas antes de habilitar.
--
-- alter table public.message_templates enable row level security;
-- alter table public.whatsapp_channels enable row level security;
-- alter table public.automation_rules enable row level security;
-- alter table public.automation_logs enable row level security;
-- alter table public.automation_cron_runs enable row level security;
-- alter table public.scale_templates enable row level security;
-- alter table public.scale_template_items enable row level security;
-- alter table public.event_musicians enable row level security;

