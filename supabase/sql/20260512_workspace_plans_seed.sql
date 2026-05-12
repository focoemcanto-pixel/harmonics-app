-- Seed oficial dos planos Harmonics SaaS
-- Pode ser executado várias vezes com segurança.
-- Ajuste preços/limites conforme estratégia comercial.

begin;

insert into public.workspace_plans (
  slug,
  name,
  monthly_price,
  max_members,
  max_events_per_month,
  max_whatsapp_messages,
  can_use_automation,
  can_use_contracts,
  can_use_whatsapp,
  can_use_white_label
)
values
  (
    'free',
    'Free',
    0,
    2,
    10,
    100,
    false,
    true,
    false,
    false
  ),
  (
    'starter',
    'Starter',
    97,
    5,
    30,
    500,
    true,
    true,
    true,
    false
  ),
  (
    'pro',
    'Pro',
    197,
    15,
    100,
    3000,
    true,
    true,
    true,
    false
  ),
  (
    'enterprise',
    'Enterprise',
    497,
    null,
    null,
    null,
    true,
    true,
    true,
    false
  ),
  (
    'white_label',
    'White Label',
    997,
    null,
    null,
    null,
    true,
    true,
    true,
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  max_members = excluded.max_members,
  max_events_per_month = excluded.max_events_per_month,
  max_whatsapp_messages = excluded.max_whatsapp_messages,
  can_use_automation = excluded.can_use_automation,
  can_use_contracts = excluded.can_use_contracts,
  can_use_whatsapp = excluded.can_use_whatsapp,
  can_use_white_label = excluded.can_use_white_label;

commit;

-- Validação:
-- select slug, name, monthly_price, max_members, max_events_per_month, max_whatsapp_messages,
--        can_use_automation, can_use_contracts, can_use_whatsapp, can_use_white_label
-- from workspace_plans
-- order by monthly_price;
