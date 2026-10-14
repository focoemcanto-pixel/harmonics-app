drop table public.billing_events;
alter table public.workspace_subscriptions drop column cancel_at_period_end;
alter table public.workspace_subscriptions drop column last_provider_event_at;
alter table public.workspace_subscriptions drop column last_provider_event;
alter table public.workspace_plans drop column description;
alter table public.workspace_plans drop column sort_order;
alter table public.workspace_plans drop column is_public;
