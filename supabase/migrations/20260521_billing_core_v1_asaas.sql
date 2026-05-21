begin;

alter table public.workspace_subscriptions
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists asaas_payment_id text,
  add column if not exists next_billing_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists last_webhook_event text;

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists billing_events_provider_event_idx
  on public.billing_events(provider, event_type, created_at desc);

commit;
