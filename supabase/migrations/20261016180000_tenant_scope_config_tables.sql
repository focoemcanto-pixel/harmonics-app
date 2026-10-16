-- Isolamento entre workspaces nas tabelas de configuração lidas pelo browser.
-- Antes: SELECT `using (true)` para qualquer usuário autenticado (um cliente novo lia tipos de evento,
-- preços e templates de escala de outros workspaces) e escrita só para admin global (um cliente novo
-- não conseguia criar templates de escala em /templates-escala).
-- Depois: leitura para membros ativos do próprio workspace; escrita para owner/admin do próprio
-- workspace. As policies de admin global existentes são mantidas (comportamento atual preservado).
-- APIs de servidor usam service_role e não são afetadas.

-- event_types
drop policy if exists "authenticated can read event_types" on public.event_types;
create policy event_types_workspace_member_select on public.event_types
  for select to authenticated
  using (current_user_is_admin() or workspace_id in (select current_user_workspace_ids()));

-- pricing_settings
drop policy if exists pricing_settings_authenticated_select on public.pricing_settings;
create policy pricing_settings_workspace_member_select on public.pricing_settings
  for select to authenticated
  using (current_user_is_admin() or workspace_id in (select current_user_workspace_ids()));

-- scale_templates
drop policy if exists scale_templates_authenticated_select on public.scale_templates;
create policy scale_templates_workspace_member_select on public.scale_templates
  for select to authenticated
  using (current_user_is_admin() or workspace_id in (select current_user_workspace_ids()));
create policy scale_templates_workspace_admin_write on public.scale_templates
  for all to authenticated
  using (current_user_is_workspace_admin(workspace_id))
  with check (current_user_is_workspace_admin(workspace_id));

-- scale_template_items (escopo herdado do template)
drop policy if exists scale_template_items_authenticated_select on public.scale_template_items;
create policy scale_template_items_workspace_member_select on public.scale_template_items
  for select to authenticated
  using (
    current_user_is_admin()
    or exists (
      select 1 from public.scale_templates t
      where t.id = scale_template_items.template_id
        and t.workspace_id in (select current_user_workspace_ids())
    )
  );
create policy scale_template_items_workspace_admin_write on public.scale_template_items
  for all to authenticated
  using (exists (
    select 1 from public.scale_templates t
    where t.id = scale_template_items.template_id and current_user_is_workspace_admin(t.workspace_id)
  ))
  with check (exists (
    select 1 from public.scale_templates t
    join public.contacts c on c.id = scale_template_items.contact_id and c.workspace_id = t.workspace_id
    where t.id = scale_template_items.template_id and current_user_is_workspace_admin(t.workspace_id)
  ));
