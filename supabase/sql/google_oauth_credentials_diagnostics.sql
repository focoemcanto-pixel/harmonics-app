-- Diagnóstico de credenciais OAuth corrompidas/invalidas.
-- Critérios:
-- 1) credentials não é objeto JSON
-- 2) objeto sem refresh_token utilizável
-- 3) refresh_token muito curto
-- 4) registro inativo (para auditoria)

select
  provider,
  is_active,
  created_at,
  updated_at,
  jsonb_typeof(credentials) as credentials_type,
  left(credentials::text, 180) as credentials_preview,
  case
    when credentials is null then 'credentials_null'
    when jsonb_typeof(credentials) <> 'object' then 'credentials_not_object'
    when coalesce(trim(credentials->>'refresh_token'), '') = ''
      and coalesce(trim(credentials#>>'{tokens,refresh_token}'), '') = '' then 'missing_refresh_token'
    when length(coalesce(trim(credentials->>'refresh_token'), trim(credentials#>>'{tokens,refresh_token}'))) < 10
      then 'refresh_token_too_short'
    when is_active = false then 'inactive_row'
    else 'ok'
  end as diagnostic_status
from public.google_oauth_credentials
order by updated_at desc;
