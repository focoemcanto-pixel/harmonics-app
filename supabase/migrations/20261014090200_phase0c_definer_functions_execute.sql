-- Fase 0c — funções SECURITY DEFINER sem EXECUTE para anon (aplicada em 2026-10-14).
-- A parte de storage NÃO pode ser aplicada via SQL (storage.objects pertence a supabase_storage_admin):
-- ver docs/saas/BLOQUEIOS_EXTERNOS.md (remover políticas de listagem pelo Dashboard).
begin;
set local lock_timeout = '5s';

-- 6) Funções SECURITY DEFINER não precisam ser executáveis por anon --------------------------
revoke execute on function public.current_user_can_access_event(uuid) from anon, public;
revoke execute on function public.current_user_can_access_module(uuid, text, text) from anon, public;
revoke execute on function public.current_user_contact_id() from anon, public;
revoke execute on function public.current_user_has_workspace_role(uuid, text[]) from anon, public;
revoke execute on function public.current_user_is_admin() from anon, public;
revoke execute on function public.current_user_is_workspace_admin(uuid) from anon, public;
revoke execute on function public.current_user_primary_workspace_id() from anon, public;
revoke execute on function public.current_user_workspace_ids() from anon, public;
revoke execute on function public.current_user_workspace_role(uuid) from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.set_workspace_id_from_current_user() from anon, authenticated, public;
revoke execute on function public.set_workspace_id_from_event() from anon, authenticated, public;

grant execute on function public.current_user_can_access_event(uuid) to authenticated, service_role;
grant execute on function public.current_user_can_access_module(uuid, text, text) to authenticated, service_role;
grant execute on function public.current_user_contact_id() to authenticated, service_role;
grant execute on function public.current_user_has_workspace_role(uuid, text[]) to authenticated, service_role;
grant execute on function public.current_user_is_admin() to authenticated, service_role;
grant execute on function public.current_user_is_workspace_admin(uuid) to authenticated, service_role;
grant execute on function public.current_user_primary_workspace_id() to authenticated, service_role;
grant execute on function public.current_user_workspace_ids() to authenticated, service_role;
grant execute on function public.current_user_workspace_role(uuid) to authenticated, service_role;

commit;
