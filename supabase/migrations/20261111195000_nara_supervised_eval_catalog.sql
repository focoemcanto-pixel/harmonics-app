-- Nara supervised evaluation catalog. Data lives only in Supabase, never in the public repository.
-- No anonymous/authenticated grants or broad policies. Admin server/service role only.
create table if not exists public.ai_eval_scenarios (
  workspace_id uuid not null,
  scenario_key text not null,
  category text not null,
  title text not null,
  user_turns jsonb not null default '[]'::jsonb,
  expected_behavior text not null,
  forbidden_behavior text,
  required_tools jsonb not null default '[]'::jsonb,
  origin_cases jsonb not null default '[]'::jsonb,
  risk text not null default 'medium',
  source_version text not null default 'nara-whatsapp-15-v1',
  evaluation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (workspace_id, scenario_key),
  constraint nara_eval_turns_array check (jsonb_typeof(user_turns) = 'array'),
  constraint nara_eval_tools_array check (jsonb_typeof(required_tools) = 'array'),
  constraint nara_eval_cases_array check (jsonb_typeof(origin_cases) = 'array'),
  constraint nara_eval_status_allowed check (evaluation_status in ('pending', 'ready', 'archived'))
);
alter table public.ai_eval_scenarios enable row level security;
revoke all on table public.ai_eval_scenarios from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_eval_scenarios to service_role;
comment on table public.ai_eval_scenarios is
  'Private, pseudonymized Nara conversational scenarios. Never use these as customer-facing knowledge or as proof of execution.';
