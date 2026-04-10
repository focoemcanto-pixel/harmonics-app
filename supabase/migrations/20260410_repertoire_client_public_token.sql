alter table public.repertoire_config
  add column if not exists client_public_token text;
