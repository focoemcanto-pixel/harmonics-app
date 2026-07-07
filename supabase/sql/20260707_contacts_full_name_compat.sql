-- Compatibilidade para consultas antigas do painel de membros.
-- Algumas telas/joins ainda consultam contacts.full_name, mas o schema atual usa contacts.name.
-- Esta migration cria um alias seguro para evitar erro PostgREST:
-- "column contacts_1.full_name does not exist".

alter table public.contacts
  add column if not exists full_name text;

update public.contacts
set full_name = coalesce(nullif(trim(full_name), ''), nullif(trim(name), ''))
where full_name is null or trim(full_name) = '';

create or replace function public.sync_contacts_full_name_from_name()
returns trigger
language plpgsql
as $$
begin
  if (new.full_name is null or trim(new.full_name) = '') and new.name is not null then
    new.full_name := new.name;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_contacts_full_name_from_name on public.contacts;

create trigger trg_sync_contacts_full_name_from_name
before insert or update of name, full_name on public.contacts
for each row
execute function public.sync_contacts_full_name_from_name();
