alter table if exists public.contracts
  add column if not exists validation_token text;

update public.contracts
set validation_token = coalesce(
  nullif(validation_token, ''),
  nullif(verification_token, ''),
  nullif(signature_metadata->>'validation_token', ''),
  nullif(signature_metadata->>'verification_token', '')
)
where coalesce(nullif(validation_token, ''), '') = '';

create unique index if not exists idx_contracts_validation_token_unique
  on public.contracts (validation_token)
  where validation_token is not null and validation_token <> '';
