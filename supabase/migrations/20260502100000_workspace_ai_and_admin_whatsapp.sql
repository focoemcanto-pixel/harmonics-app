alter table if exists public.workspace_settings
  add column if not exists admin_whatsapp_phone text,
  add column if not exists ai_enabled boolean not null default false,
  add column if not exists ai_provider text not null default 'openai',
  add column if not exists ai_api_key text,
  add column if not exists ai_model text not null default 'gpt-4.1-mini',
  add column if not exists ai_fallback_only boolean not null default true,
  add column if not exists ai_monthly_limit integer;
