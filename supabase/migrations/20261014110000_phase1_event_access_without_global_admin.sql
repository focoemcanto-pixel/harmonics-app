-- Fase 1.3 — current_user_can_access_event deixa de liberar TODOS os eventos de TODOS os
-- workspaces para profiles.role='admin'. O acesso de administração passa a ser por membership
-- (admin/owner do workspace do evento). Músicos/convidados mantêm o acesso por escala/convite.
-- Validado em produção antes de aplicar: contagens visíveis para o admin Harmonics e para um
-- músico idênticas antes/depois. Aplicada em 2026-10-14.
create or replace function public.current_user_can_access_event(target_event_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (select 1 from events e where e.id = target_event_id and public.current_user_is_workspace_admin(e.workspace_id))
    or exists (select 1 from event_musicians em where em.event_id = target_event_id and em.musician_id = public.current_user_contact_id() and coalesce(em.is_active, true) = true)
    or exists (select 1 from invites i where i.event_id = target_event_id and i.contact_id = public.current_user_contact_id() and coalesce(i.status, '') <> 'removed');
$$;
