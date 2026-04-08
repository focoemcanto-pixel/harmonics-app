-- Normaliza e remove credenciais OAuth inválidas da tabela google_oauth_credentials.

-- 1) Converte string JSON serializada para objeto JSONB quando possível.
update public.google_oauth_credentials
set credentials = (trim(both '"' from credentials::text))::jsonb,
    updated_at = timezone('utc'::text, now())
where jsonb_typeof(credentials) = 'string'
  and trim(both '"' from credentials::text) like '{%}';

-- 2) Se refresh_token vier apenas em credentials.tokens.refresh_token,
-- promove para credentials.refresh_token.
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

-- 3) Remove linhas inválidas (sem refresh_token válido ou tipo incorreto).
delete from public.google_oauth_credentials
where credentials is null
   or jsonb_typeof(credentials) <> 'object'
   or coalesce(trim(credentials->>'refresh_token'), '') = ''
   or length(trim(credentials->>'refresh_token')) < 10;
