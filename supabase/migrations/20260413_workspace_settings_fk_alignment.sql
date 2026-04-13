-- Align automation workspace_id references to workspace_settings.id
-- This migration ensures logging and lookup use a consistent workspace key.

do $$
declare
  rec record;
begin
  for rec in
    select conname
    from pg_constraint
    where conrelid = 'public.whatsapp_channels'::regclass
      and contype = 'f'
      and array_position(conkey, (
        select attnum from pg_attribute
        where attrelid = 'public.whatsapp_channels'::regclass
          and attname = 'workspace_id'
      )) is not null
  loop
    execute format('alter table public.whatsapp_channels drop constraint %I', rec.conname);
  end loop;

  for rec in
    select conname
    from pg_constraint
    where conrelid = 'public.automation_logs'::regclass
      and contype = 'f'
      and array_position(conkey, (
        select attnum from pg_attribute
        where attrelid = 'public.automation_logs'::regclass
          and attname = 'workspace_id'
      )) is not null
  loop
    execute format('alter table public.automation_logs drop constraint %I', rec.conname);
  end loop;

  for rec in
    select conname
    from pg_constraint
    where conrelid = 'public.automation_rules'::regclass
      and contype = 'f'
      and array_position(conkey, (
        select attnum from pg_attribute
        where attrelid = 'public.automation_rules'::regclass
          and attname = 'workspace_id'
      )) is not null
  loop
    execute format('alter table public.automation_rules drop constraint %I', rec.conname);
  end loop;

  for rec in
    select conname
    from pg_constraint
    where conrelid = 'public.message_templates'::regclass
      and contype = 'f'
      and array_position(conkey, (
        select attnum from pg_attribute
        where attrelid = 'public.message_templates'::regclass
          and attname = 'workspace_id'
      )) is not null
  loop
    execute format('alter table public.message_templates drop constraint %I', rec.conname);
  end loop;
end $$;

alter table public.whatsapp_channels
  add constraint whatsapp_channels_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspace_settings(id)
  on delete set null;

alter table public.automation_logs
  add constraint automation_logs_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspace_settings(id)
  on delete set null;

alter table public.automation_rules
  add constraint automation_rules_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspace_settings(id)
  on delete set null;

alter table public.message_templates
  add constraint message_templates_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspace_settings(id)
  on delete set null;
