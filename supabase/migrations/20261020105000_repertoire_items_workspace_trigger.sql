-- Hotfix: repertoire_items.workspace_id became NOT NULL during multi-tenant hardening,
-- but the public client repertoire save flow still inserts items without workspace_id.
-- Derive and validate the tenant from the authoritative event relationship so legacy
-- and current server-side writers cannot create cross-tenant repertoire rows.

begin;

create or replace function public.set_repertoire_item_workspace_from_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  event_workspace_id uuid;
begin
  select e.workspace_id
    into event_workspace_id
    from public.events e
   where e.id = new.event_id;

  if event_workspace_id is null then
    raise exception 'Evento sem workspace válido para item de repertório.';
  end if;

  if new.workspace_id is not null and new.workspace_id <> event_workspace_id then
    raise exception 'Workspace do item de repertório não corresponde ao workspace do evento.';
  end if;

  new.workspace_id := event_workspace_id;
  return new;
end;
$$;

revoke execute on function public.set_repertoire_item_workspace_from_event() from public, anon, authenticated;

drop trigger if exists trg_repertoire_items_set_workspace_from_event on public.repertoire_items;
create trigger trg_repertoire_items_set_workspace_from_event
before insert or update of event_id, workspace_id on public.repertoire_items
for each row execute function public.set_repertoire_item_workspace_from_event();

commit;
