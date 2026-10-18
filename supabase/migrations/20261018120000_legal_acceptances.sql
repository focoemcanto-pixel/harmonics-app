/* Aceite auditável dos Termos de Uso e da Política de Privacidade (uma linha por documento e versão).
   accepted_at = momento do aceite informado pelo navegador; recorded_at = registro no servidor.
   Sem FK para auth.users: o registro do aceite precisa sobreviver à exclusão da conta.
   Acesso só pelo servidor (service_role); RLS sem policies. Criação aditiva. */
begin;
set local lock_timeout = '5s';
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  document text not null check (document in ('terms', 'privacy')),
  version text not null,
  accepted_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  workspace_id uuid,
  source text,
  ip_address text,
  user_agent text,
  unique (user_id, document, version)
);
create index if not exists legal_acceptances_user_idx on public.legal_acceptances (user_id, recorded_at desc);
alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from anon, authenticated;
grant all on public.legal_acceptances to service_role;
commit;
