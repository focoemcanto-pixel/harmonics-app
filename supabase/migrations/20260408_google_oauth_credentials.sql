-- Armazena credenciais OAuth2 do Google em formato JSONB para evitar
-- problemas com refresh_token serializado como string.
create table if not exists public.google_oauth_credentials (
  provider text primary key,
  credentials jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.google_oauth_credentials is
  'Credenciais OAuth2 (JSONB) usadas na geração de contratos Google Docs/Drive.';

comment on column public.google_oauth_credentials.credentials is
  'Sempre armazenar objeto JSON (ex.: {"refresh_token":"1//..."}), nunca string JSON serializada.';

-- Migração de registros legados: se credentials vier como string JSON em jsonb,
-- converte para objeto de forma segura.
update public.google_oauth_credentials
set credentials = (trim(both '"' from credentials::text))::jsonb,
    updated_at = timezone('utc'::text, now())
where jsonb_typeof(credentials) = 'string'
  and trim(both '"' from credentials::text) like '{%}';
