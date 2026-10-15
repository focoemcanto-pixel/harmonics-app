-- Fase 0b — RLS/grants das tabelas sem proteção (ver mapa em 20261014090000_phase0a).
begin;
set local lock_timeout = '5s';

-- 2) Tabelas exclusivamente server-side ----------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'google_oauth_credentials',
    'workspace_settings',
    'client_reviews',
    'users',
    'roles',
    'assignments',
    'event_role_slots',
    'suggestion_collection_songs',
    'suggestion_collections',
    'suggestion_genres',
    'suggestion_moments',
    'suggestion_song_tags',
    'suggestion_songs',
    'suggestion_tags',
    'suggestion_songs_backup_20260414',
    'suggestion_songs_backup_20260414_legacy_non_gospel',
    'suggestion_songs_backup_20260414_non_gospel',
    'suggestion_songs_backup_20260414_non_gospel_only',
    'suggestion_songs_backup_20260414_v2'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- View SECURITY DEFINER sem consumidor client-side.
revoke all on table public.suggestion_songs_ranked from anon, authenticated;

-- 3) Tabelas lidas pelo browser autenticado -------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['pricing_settings', 'scale_templates', 'scale_template_items']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke truncate, references, trigger on table public.%I from authenticated', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_authenticated_select', t
    );

    execute format(
      'create policy %I on public.%I for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin())',
      t || '_platform_admin_write', t
    );
  end loop;
end $$;

-- 4) Catálogo de planos: leitura pública, escrita só service role --------------------------
alter table public.workspace_plans enable row level security;
revoke insert, update, delete, truncate, references, trigger on table public.workspace_plans from anon, authenticated;
create policy workspace_plans_public_select on public.workspace_plans
  for select to anon, authenticated using (true);

commit;
