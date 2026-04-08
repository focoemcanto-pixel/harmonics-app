-- Ajusta a tabela para escopo por usuário e upsert por user_id.
alter table if exists public.google_oauth_credentials
  add column if not exists user_id text,
  add column if not exists status text not null default 'valid';

-- Garante unicidade por usuário para uso com onConflict: 'user_id'.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'unique_user_credentials'
      and conrelid = 'public.google_oauth_credentials'::regclass
  ) then
    alter table public.google_oauth_credentials
      add constraint unique_user_credentials unique (user_id);
  end if;
end $$;

-- Se existirem registros legados sem user_id, mantém status consistente.
update public.google_oauth_credentials
set status = case when is_active then 'valid' else 'expired' end
where status is null
   or status = '';
