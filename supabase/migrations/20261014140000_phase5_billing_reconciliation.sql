-- Fase 5 — billing reconciliado com o schema REAL (aplicada em 2026-10-14).
-- A migration 20260521_billing_core_v1_asaas nunca foi aplicada e duplicaria colunas que já
-- existem (provider, provider_customer_id, provider_subscription_id, cancelled_at). Esta versão
-- reaproveita as existentes e adiciona apenas o necessário. Tudo aditivo.

-- Catálogo de planos: fonte única para UI e backend.
alter table public.workspace_plans add column is_public boolean not null default true;
alter table public.workspace_plans add column sort_order integer not null default 0;
alter table public.workspace_plans add column description text;
update public.workspace_plans set sort_order = case slug when 'free' then 0 when 'starter' then 10 when 'pro' then 20 when 'enterprise' then 30 when 'white_label' then 40 else 100 end where slug in ('free','starter','pro','enterprise','white_label');

-- Estado do provedor na assinatura (ordem de eventos e cancelamento no fim do período).
alter table public.workspace_subscriptions add column last_provider_event text;
alter table public.workspace_subscriptions add column last_provider_event_at timestamptz;
alter table public.workspace_subscriptions add column cancel_at_period_end boolean not null default false;

-- Log auditável e idempotente de webhooks (um registro por evento do provedor).
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  event_created_at timestamptz,
  workspace_id uuid references public.workspaces(id),
  provider_subscription_id text,
  provider_payment_id text,
  status text not null default 'received',
  error text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint billing_events_provider_event_unique unique (provider, event_id)
);
create index billing_events_workspace_idx on public.billing_events(workspace_id, received_at desc);
create index billing_events_subscription_idx on public.billing_events(provider_subscription_id);
alter table public.billing_events enable row level security;
revoke all on table public.billing_events from anon, authenticated;
