-- Rollback da Fase 0 (0a, 0b, 0c). Restaura exatamente o estado de 2026-10-13.
-- ATENÇÃO: reabrir estas permissões reexpõe as vulnerabilidades corrigidas. Use só em incidente.

-- 0a
drop trigger trg_guard_profile_privilege_columns on public.profiles;
drop function public.guard_profile_privilege_columns();

-- 0b: tabelas que estavam sem RLS e com GRANT ALL para anon/authenticated
do $$ declare t text; begin
  foreach t in array array['google_oauth_credentials','workspace_settings','client_reviews','users','roles','assignments',
    'event_role_slots','suggestion_collection_songs','suggestion_collections','suggestion_genres','suggestion_moments',
    'suggestion_song_tags','suggestion_songs','suggestion_tags','suggestion_songs_backup_20260414',
    'suggestion_songs_backup_20260414_legacy_non_gospel','suggestion_songs_backup_20260414_non_gospel',
    'suggestion_songs_backup_20260414_non_gospel_only','suggestion_songs_backup_20260414_v2',
    'pricing_settings','scale_templates','scale_template_items','workspace_plans'] loop
    execute format('alter table public.%I disable row level security', t);
    execute format('grant all on table public.%I to anon, authenticated', t);
  end loop; end $$;
grant all on table public.suggestion_songs_ranked to anon, authenticated;
drop policy pricing_settings_authenticated_select on public.pricing_settings;
drop policy pricing_settings_platform_admin_write on public.pricing_settings;
drop policy scale_templates_authenticated_select on public.scale_templates;
drop policy scale_templates_platform_admin_write on public.scale_templates;
drop policy scale_template_items_authenticated_select on public.scale_template_items;
drop policy scale_template_items_platform_admin_write on public.scale_template_items;
drop policy workspace_plans_public_select on public.workspace_plans;

-- 0c
grant execute on function public.current_user_can_access_event(uuid) to anon, public;
grant execute on function public.current_user_can_access_module(uuid, text, text) to anon, public;
grant execute on function public.current_user_contact_id() to anon, public;
grant execute on function public.current_user_has_workspace_role(uuid, text[]) to anon, public;
grant execute on function public.current_user_is_admin() to anon, public;
grant execute on function public.current_user_is_workspace_admin(uuid) to anon, public;
grant execute on function public.current_user_primary_workspace_id() to anon, public;
grant execute on function public.current_user_workspace_ids() to anon, public;
grant execute on function public.current_user_workspace_role(uuid) to anon, public;
grant execute on function public.handle_new_user() to anon, authenticated, public;
grant execute on function public.set_workspace_id_from_current_user() to anon, authenticated, public;
grant execute on function public.set_workspace_id_from_event() to anon, authenticated, public;
