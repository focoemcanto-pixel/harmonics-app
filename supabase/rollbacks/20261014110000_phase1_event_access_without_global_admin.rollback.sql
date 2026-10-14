create or replace function public.current_user_can_access_event(target_event_id uuid)
returns boolean language sql security definer set search_path to 'public' as $$
  select public.current_user_is_admin()
    or exists (select 1 from event_musicians em where em.event_id = target_event_id and em.musician_id = public.current_user_contact_id() and coalesce(em.is_active, true) = true)
    or exists (select 1 from invites i where i.event_id = target_event_id and i.contact_id = public.current_user_contact_id() and coalesce(i.status, '') <> 'removed');
$$;
