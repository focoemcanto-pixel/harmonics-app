-- RLS, policies e grants de anon/authenticated idênticos à produção (2026-10-16).
-- Tabelas sem grant para anon/authenticated em produção ficam sem grant aqui também.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array[
    'automation_cron_runs','automation_logs','automation_rules','contacts','contract_adjustment_requests',
    'contract_templates','contracts','event_musicians','event_types','events','finance_cost_defaults','invites',
    'message_templates','payments','precontracts','profiles','quote_locations','quote_price_rules','quotes',
    'repertoire_config','repertoire_items','repertoire_tokens','whatsapp_channels','workspace_activity_events',
    'workspace_invites','workspace_members','workspace_onboarding_progress','workspace_subscriptions',
    'workspace_tour_progress','workspaces'] loop
    execute format('grant all on public.%I to anon, authenticated', t);
  end loop;
end $$;
grant select, insert, update, delete on public.pricing_settings, public.scale_template_items, public.scale_templates to authenticated;
grant select on public.workspace_plans to anon, authenticated;

create policy automation_cron_runs_workspace_admin_all on public.automation_cron_runs for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy automation_logs_workspace_admin_all on public.automation_logs for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy automation_rules_workspace_admin_all on public.automation_rules for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy contacts_member_select_self on public.contacts for select to authenticated using ((id = current_user_contact_id()));
create policy contacts_workspace_admin_all on public.contacts for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy contract_adjustment_requests_public_insert on public.contract_adjustment_requests for insert to public with check (true);
create policy contract_adjustment_requests_workspace_admin_select on public.contract_adjustment_requests for select to authenticated using ((exists (select 1 from precontracts p where p.id = contract_adjustment_requests.precontract_id and current_user_is_workspace_admin(p.workspace_id))));
create policy contract_templates_admin_delete on public.contract_templates for delete to authenticated using (current_user_is_admin());
create policy contract_templates_admin_insert on public.contract_templates for insert to authenticated with check (current_user_is_admin());
create policy contract_templates_admin_select on public.contract_templates for select to authenticated using (current_user_is_admin());
create policy contract_templates_admin_update on public.contract_templates for update to authenticated using (current_user_is_admin()) with check (current_user_is_admin());
create policy contracts_member_select_related_event on public.contracts for select to authenticated using (current_user_can_access_event(event_id));
create policy contracts_workspace_admin_all on public.contracts for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy event_musicians_member_select_own_events on public.event_musicians for select to authenticated using (current_user_can_access_event(event_id));
create policy event_musicians_workspace_admin_all on public.event_musicians for all to authenticated using ((exists (select 1 from events e where e.id = event_musicians.event_id and current_user_is_workspace_admin(e.workspace_id)))) with check ((exists (select 1 from events e where e.id = event_musicians.event_id and current_user_is_workspace_admin(e.workspace_id))));
create policy "authenticated can read event_types" on public.event_types for select to authenticated using (true);
create policy event_types_admin_update on public.event_types for update to authenticated using (current_user_is_admin()) with check (current_user_is_admin());
create policy events_member_select_assigned on public.events for select to authenticated using (current_user_can_access_event(id));
create policy events_workspace_admin_all on public.events for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy invites_member_select_own on public.invites for select to authenticated using ((contact_id = current_user_contact_id()));
create policy invites_workspace_admin_all on public.invites for all to authenticated using ((exists (select 1 from events e where e.id = invites.event_id and current_user_is_workspace_admin(e.workspace_id)))) with check ((exists (select 1 from events e where e.id = invites.event_id and current_user_is_workspace_admin(e.workspace_id))));
create policy message_templates_workspace_admin_all on public.message_templates for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy payments_member_select_event on public.payments for select to authenticated using (current_user_can_access_event(event_id));
create policy payments_workspace_admin_all on public.payments for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy precontracts_member_select_related_event on public.precontracts for select to authenticated using (current_user_can_access_event(event_id));
create policy precontracts_workspace_admin_all on public.precontracts for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy pricing_settings_authenticated_select on public.pricing_settings for select to authenticated using (true);
create policy pricing_settings_platform_admin_write on public.pricing_settings for all to authenticated using (current_user_is_admin()) with check (current_user_is_admin());
create policy profiles_admin_all on public.profiles for all to authenticated using (current_user_is_admin()) with check (current_user_is_admin());
create policy profiles_select_own on public.profiles for select to authenticated using ((id = auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using ((id = auth.uid())) with check ((id = auth.uid()));
create policy quote_locations_workspace on public.quote_locations for all to authenticated using ((workspace_id in (select wm.workspace_id from workspace_members wm where wm.user_id = (select auth.uid()) and wm.status = 'active'))) with check ((workspace_id in (select wm.workspace_id from workspace_members wm where wm.user_id = (select auth.uid()) and wm.status = 'active')));
create policy quotes_workspace on public.quotes for all to authenticated using ((workspace_id in (select wm.workspace_id from workspace_members wm where wm.user_id = (select auth.uid()) and wm.status = 'active'))) with check ((workspace_id in (select wm.workspace_id from workspace_members wm where wm.user_id = (select auth.uid()) and wm.status = 'active')));
create policy repertoire_items_member_select_event on public.repertoire_items for select to authenticated using (current_user_can_access_event(event_id));
create policy repertoire_items_workspace_admin_all on public.repertoire_items for all to authenticated using ((exists (select 1 from events e where e.id = repertoire_items.event_id and current_user_is_workspace_admin(e.workspace_id)))) with check ((exists (select 1 from events e where e.id = repertoire_items.event_id and current_user_is_workspace_admin(e.workspace_id))));
create policy scale_template_items_platform_admin_write on public.scale_template_items for all to authenticated using (current_user_is_admin()) with check (current_user_is_admin());
create policy scale_template_items_authenticated_select on public.scale_template_items for select to authenticated using (true);
create policy scale_templates_authenticated_select on public.scale_templates for select to authenticated using (true);
create policy scale_templates_platform_admin_write on public.scale_templates for all to authenticated using (current_user_is_admin()) with check (current_user_is_admin());
create policy whatsapp_channels_workspace_admin_all on public.whatsapp_channels for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy workspace_invites_admin_all on public.workspace_invites for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy workspace_members_admin_manage on public.workspace_members for all to authenticated using (current_user_is_workspace_admin(workspace_id)) with check (current_user_is_workspace_admin(workspace_id));
create policy workspace_members_select_own_workspaces on public.workspace_members for select to authenticated using (((user_id = auth.uid()) or current_user_is_workspace_admin(workspace_id)));
create policy workspace_plans_public_select on public.workspace_plans for select to anon, authenticated using (true);
create policy workspaces_admin_update on public.workspaces for update to authenticated using (current_user_is_workspace_admin(id)) with check (current_user_is_workspace_admin(id));
create policy workspaces_member_select on public.workspaces for select to authenticated using ((exists (select 1 from workspace_members wm where wm.workspace_id = workspaces.id and wm.user_id = auth.uid() and wm.status = 'active')));

-- Único dado copiado: catálogo de planos (estrutural, público na tela de preços).
insert into public.workspace_plans (slug, name, monthly_price, max_members, max_events_per_month, max_whatsapp_messages, can_use_automation, can_use_contracts, can_use_whatsapp, can_use_white_label, is_public, sort_order) values
  ('free', 'Free', 0, 2, 10, 100, false, true, false, false, true, 0),
  ('starter', 'Starter', 97, 5, 30, 500, true, true, true, false, true, 10),
  ('pro', 'Pro', 197, 15, 100, 3000, true, true, true, false, true, 20),
  ('enterprise', 'Enterprise', 497, null, null, null, true, true, true, false, true, 30),
  ('white_label', 'White Label', 997, null, null, null, true, true, true, true, true, 40)
on conflict (slug) do nothing;
