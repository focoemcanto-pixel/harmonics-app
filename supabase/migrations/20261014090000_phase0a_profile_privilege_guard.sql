-- Fase 0 — Contenção de segurança (backward-compatible)
--
-- Escopo: somente permissões, RLS e políticas. Nenhuma linha de dados é alterada.
--
-- Mapa de acesso que fundamenta esta migration (revalidado em 2026-10-14):
--   * Tabelas acessadas APENAS pelo servidor com service role (bypass de RLS):
--       google_oauth_credentials, workspace_settings, client_reviews, users, roles,
--       assignments, event_role_slots, suggestion_* e backups suggestion_songs_backup_*.
--     -> RLS ligado, sem políticas, REVOKE de anon/authenticated.
--   * Tabelas lidas pelo browser autenticado (admin Harmonics e membro com escala delegada):
--       pricing_settings (lida e gravada em /eventos), scale_templates e scale_template_items
--       (lidas em EventoEscalaTab/MembroEscalaModal, gravadas em /templates-escala).
--     -> RLS ligado; SELECT para authenticated; escrita só para admin de plataforma
--        (mesmo critério current_user_is_admin() já usado nas demais políticas).
--   * workspace_plans: catálogo de planos (lido por /settings/billing com sessão).
--     -> SELECT público; escrita só service role.
--   * Nenhum consumidor anônimo (anon) usa estas tabelas: portais públicos rodam no servidor
--     com service role, e /contrato/[token] só toca tabelas que já tinham RLS.
--
-- Rollback: supabase/rollbacks/20261014090000_phase0.rollback.sql (cobre 0a, 0b e 0c)

begin;
set local lock_timeout = '5s';

-- 1) Bloqueia escalonamento de privilégio via profiles.role -------------------------------
create or replace function public.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := coalesce(auth.role(), '');
begin
  -- service_role (APIs do servidor), postgres e o trigger de signup (sem JWT) continuam livres.
  if caller_role not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if lower(coalesce(new.role, 'member')) <> 'member' then
      raise exception 'Alteração de privilégio não permitida.' using errcode = '42501';
    end if;
  elsif new.role is distinct from old.role then
    raise exception 'Alteração de privilégio não permitida.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_guard_profile_privilege_columns
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privilege_columns();

revoke execute on function public.guard_profile_privilege_columns() from anon, authenticated, public;

commit;
