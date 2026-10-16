/* Isolamento entre workspaces nas tabelas de configuração lidas pelo browser.
   Antes: SELECT using (true) para qualquer usuário autenticado (um cliente novo lia tipos de evento,
   preços e templates de escala de outros workspaces) e escrita só para admin global (um cliente novo
   não conseguia criar templates de escala em /templates-escala).
   Depois: leitura para admin global ou membros ativos do próprio workspace; escrita também para
   owner/admin do próprio workspace. As policies de admin global existentes são mantidas.
   Nenhuma policy é removida: as 4 policies de leitura existentes são alteradas (ALTER POLICY, mantendo nomes) e só as
   2 policies de escrita são criadas, com guarda de existência (pode rodar mais de uma vez).
   Somente comentários de bloco: o script continua correto se colado em uma linha só.
   APIs de servidor usam service_role e não são afetadas. */
begin;
set local lock_timeout = '5s';
alter policy "authenticated can read event_types" on public.event_types using (current_user_is_admin() or workspace_id in (select current_user_workspace_ids()));
alter policy pricing_settings_authenticated_select on public.pricing_settings using (current_user_is_admin() or workspace_id in (select current_user_workspace_ids()));
alter policy scale_templates_authenticated_select on public.scale_templates using (current_user_is_admin() or workspace_id in (select current_user_workspace_ids()));
alter policy scale_template_items_authenticated_select on public.scale_template_items using (current_user_is_admin() or exists (select 1 from public.scale_templates t where t.id = scale_template_items.template_id and t.workspace_id in (select current_user_workspace_ids())));
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scale_templates' and policyname = 'scale_templates_workspace_admin_write') then create policy scale_templates_workspace_admin_write on public.scale_templates for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id)); end if; end $$;
do $$ begin if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scale_template_items' and policyname = 'scale_template_items_workspace_admin_write') then create policy scale_template_items_workspace_admin_write on public.scale_template_items for all to authenticated using (exists (select 1 from public.scale_templates t where t.id = scale_template_items.template_id and current_user_is_workspace_admin(t.workspace_id))) with check (exists (select 1 from public.scale_templates t join public.contacts c on c.id = scale_template_items.contact_id and c.workspace_id = t.workspace_id where t.id = scale_template_items.template_id and current_user_is_workspace_admin(t.workspace_id))); end if; end $$;
commit;
