-- Funções e triggers do snapshot de produção (unaccent vem da extensão).
CREATE OR REPLACE FUNCTION public.current_user_is_workspace_admin(target_workspace_id uuid)
 RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.workspace_members wm
    where wm.user_id = auth.uid() and wm.workspace_id = target_workspace_id and wm.status = 'active'
      and lower(coalesce(wm.role, '')) in ('owner', 'admin', 'administrador')
  );
$function$;

CREATE OR REPLACE FUNCTION public.current_user_contact_id()
 RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id FROM contacts c JOIN auth.users u ON lower(c.email) = lower(u.email)
  WHERE u.id = auth.uid() AND coalesce(c.is_active, true) = true LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_event(target_event_id uuid)
 RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select exists (select 1 from events e where e.id = target_event_id and public.current_user_is_workspace_admin(e.workspace_id))
    or exists (select 1 from event_musicians em where em.event_id = target_event_id and em.musician_id = public.current_user_contact_id() and coalesce(em.is_active, true) = true)
    or exists (select 1 from invites i where i.event_id = target_event_id and i.contact_id = public.current_user_contact_id() and coalesce(i.status, '') <> 'removed');
$function$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_module(target_workspace_id uuid, module_key text, action_key text DEFAULT 'read'::text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  user_role text;
  module text := lower(coalesce(module_key, ''));
  action text := lower(coalesce(action_key, 'read'));
begin
  select lower(wm.role) into user_role from public.workspace_members wm
  where wm.user_id = auth.uid() and wm.workspace_id = target_workspace_id and wm.status = 'active' limit 1;
  if user_role is null then return false; end if;
  if user_role in ('owner', 'admin') then return true; end if;
  if user_role = 'financeiro' then return module in ('dashboard', 'pagamentos', 'contracts', 'contracts_read', 'contacts_read'); end if;
  if user_role = 'operacional' then return module in ('dashboard', 'events', 'contacts', 'invites', 'scales', 'repertorios', 'contracts_read'); end if;
  if user_role = 'editor' then return module in ('dashboard', 'events', 'contacts', 'repertorios', 'suggestions'); end if;
  if user_role = 'viewer' then return action = 'read' and module in ('dashboard', 'events', 'contacts', 'contracts_read', 'pagamentos_read', 'repertorios'); end if;
  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_workspace_role(target_workspace_id uuid)
 RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select wm.role from public.workspace_members wm
  where wm.user_id = auth.uid() and wm.workspace_id = target_workspace_id and wm.status = 'active' limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_has_workspace_role(target_workspace_id uuid, allowed_roles text[])
 RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select lower(coalesce(public.current_user_workspace_role(target_workspace_id), '')) = any (select lower(role) from unnest(allowed_roles) as role);
$function$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
 RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(coalesce(p.role, '')) IN ('admin', 'administrador'));
$function$;

CREATE OR REPLACE FUNCTION public.current_user_primary_workspace_id()
 RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select wm.workspace_id from public.workspace_members wm
  where wm.user_id = auth.uid() and wm.status = 'active'
  order by case lower(coalesce(wm.role, '')) when 'owner' then 1 when 'admin' then 2 when 'administrador' then 3 else 9 end, wm.created_at asc
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_workspace_ids()
 RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select wm.workspace_id from public.workspace_members wm where wm.user_id = auth.uid() and wm.status = 'active';
$function$;

CREATE OR REPLACE FUNCTION public.ensure_workspace_free_subscription()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
declare free_plan_id uuid;
begin
  select id into free_plan_id from public.workspace_plans where slug = 'free' limit 1;
  if free_plan_id is null then raise exception 'Plano FREE não encontrado em workspace_plans.'; end if;
  insert into public.workspace_subscriptions (workspace_id, plan_id, status, started_at, current_period_start, metadata)
  values (new.id, free_plan_id, 'active', now(), date_trunc('month', now()), jsonb_build_object('source', 'auto_workspace_onboarding'))
  on conflict do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_profile_privilege_columns()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare caller_role text := coalesce(auth.role(), '');
begin
  if caller_role not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'INSERT' then
    if lower(coalesce(new.role, 'member')) <> 'member' then raise exception 'Alteração de privilégio não permitida.' using errcode = '42501'; end if;
  elsif new.role is distinct from old.role then raise exception 'Alteração de privilégio não permitida.' using errcode = '42501';
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role) VALUES (NEW.id, NEW.email, 'member');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger LANGUAGE plpgsql
AS $function$ begin new.updated_at = now(); return new; end; $function$;

CREATE OR REPLACE FUNCTION public.set_workspace_id_from_current_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if new.workspace_id is null and auth.uid() is not null then
    new.workspace_id := public.current_user_primary_workspace_id();
  end if;
  if new.workspace_id is null then raise exception 'workspace_id obrigatório'; end if;
  if auth.uid() is not null and not public.current_user_is_workspace_admin(new.workspace_id) then
    raise exception 'Usuário não autorizado para este workspace';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_workspace_id_from_event()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare resolved_workspace_id uuid;
begin
  if new.event_id is null then raise exception 'event_id obrigatório para definir workspace_id'; end if;
  select e.workspace_id into resolved_workspace_id from public.events e where e.id = new.event_id;
  if resolved_workspace_id is null then raise exception 'workspace_id do evento não encontrado'; end if;
  if new.workspace_id is null then new.workspace_id := resolved_workspace_id; end if;
  if new.workspace_id <> resolved_workspace_id then raise exception 'workspace_id incompatível com o evento'; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_contacts_full_name_from_name()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
begin
  if (new.full_name is null or trim(new.full_name) = '') and new.name is not null then new.full_name := new.name; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.op_finance_immutable()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$ begin raise exception 'Histórico imutável: use um estorno.'; end $function$;

CREATE TRIGGER trg_contacts_set_workspace BEFORE INSERT OR UPDATE OF workspace_id ON public.contacts FOR EACH ROW EXECUTE FUNCTION set_workspace_id_from_current_user();
CREATE TRIGGER trg_sync_contacts_full_name_from_name BEFORE INSERT OR UPDATE OF name, full_name ON public.contacts FOR EACH ROW EXECUTE FUNCTION sync_contacts_full_name_from_name();
CREATE TRIGGER trg_contracts_set_workspace BEFORE INSERT OR UPDATE OF workspace_id ON public.contracts FOR EACH ROW EXECUTE FUNCTION set_workspace_id_from_current_user();
CREATE TRIGGER trg_events_set_workspace BEFORE INSERT OR UPDATE OF workspace_id ON public.events FOR EACH ROW EXECUTE FUNCTION set_workspace_id_from_current_user();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER op_audit_immutable BEFORE DELETE OR UPDATE ON public.op_finance_audit FOR EACH ROW EXECUTE FUNCTION op_finance_immutable();
CREATE TRIGGER op_ledger_immutable BEFORE DELETE OR UPDATE ON public.op_finance_ledger FOR EACH ROW EXECUTE FUNCTION op_finance_immutable();
CREATE TRIGGER trg_payments_set_workspace BEFORE INSERT OR UPDATE OF workspace_id ON public.payments FOR EACH ROW EXECUTE FUNCTION set_workspace_id_from_current_user();
CREATE TRIGGER trg_precontracts_set_workspace BEFORE INSERT OR UPDATE OF workspace_id ON public.precontracts FOR EACH ROW EXECUTE FUNCTION set_workspace_id_from_current_user();
CREATE TRIGGER trg_guard_profile_privilege_columns BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_privilege_columns();
CREATE TRIGGER trg_repertoire_items_set_workspace_from_event BEFORE INSERT OR UPDATE OF event_id, workspace_id ON public.repertoire_items FOR EACH ROW EXECUTE FUNCTION set_workspace_id_from_event();
CREATE TRIGGER trg_repertoire_tokens_set_workspace_from_event BEFORE INSERT OR UPDATE OF event_id, workspace_id ON public.repertoire_tokens FOR EACH ROW EXECUTE FUNCTION set_workspace_id_from_event();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER trg_workspaces_auto_free_subscription AFTER INSERT ON public.workspaces FOR EACH ROW EXECUTE FUNCTION ensure_workspace_free_subscription();
