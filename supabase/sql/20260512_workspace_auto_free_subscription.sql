-- Auto-onboarding de tenants
-- Sempre que um workspace é criado, recebe automaticamente assinatura FREE.
-- Também faz backfill para workspaces existentes sem assinatura.

begin;

create or replace function public.ensure_workspace_free_subscription()
returns trigger
language plpgsql
as $$
declare
  free_plan_id uuid;
begin
  select id into free_plan_id
  from public.workspace_plans
  where slug = 'free'
  limit 1;

  if free_plan_id is null then
    raise exception 'Plano FREE não encontrado em workspace_plans. Execute o seed de planos antes.';
  end if;

  insert into public.workspace_subscriptions (
    workspace_id,
    plan_id,
    status,
    started_at,
    current_period_start,
    metadata
  )
  values (
    new.id,
    free_plan_id,
    'active',
    now(),
    date_trunc('month', now()),
    jsonb_build_object('source', 'auto_workspace_onboarding')
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_workspaces_auto_free_subscription on public.workspaces;
create trigger trg_workspaces_auto_free_subscription
after insert on public.workspaces
for each row
execute function public.ensure_workspace_free_subscription();

-- Backfill para workspaces existentes sem assinatura ativa.
insert into public.workspace_subscriptions (
  workspace_id,
  plan_id,
  status,
  started_at,
  current_period_start,
  metadata
)
select
  w.id,
  p.id,
  'active',
  now(),
  date_trunc('month', now()),
  jsonb_build_object('source', 'backfill_auto_free_subscription')
from public.workspaces w
cross join public.workspace_plans p
where p.slug = 'free'
  and not exists (
    select 1
    from public.workspace_subscriptions ws
    where ws.workspace_id = w.id
      and ws.status in ('active', 'trialing', 'past_due', 'paused')
  );

commit;

-- Validação:
-- select
--   w.id,
--   w.name,
--   wp.slug as plan_slug,
--   ws.status
-- from workspaces w
-- left join workspace_subscriptions ws on ws.workspace_id = w.id
-- left join workspace_plans wp on wp.id = ws.plan_id
-- order by w.created_at desc;
