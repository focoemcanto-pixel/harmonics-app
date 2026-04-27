-- Criação da tabela de auditoria para ações críticas.
-- Execute no projeto Supabase (SQL Editor ou migration).

create extension if not exists pgcrypto;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid null,
  actor_email text null,
  action text not null,
  entity_type text null,
  entity_id text null,
  status text not null default 'success',
  ip text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists audit_logs_created_at_desc_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_actor_user_id_idx
  on public.audit_logs (actor_user_id);

create index if not exists audit_logs_action_idx
  on public.audit_logs (action);

create index if not exists audit_logs_entity_type_entity_id_idx
  on public.audit_logs (entity_type, entity_id);
