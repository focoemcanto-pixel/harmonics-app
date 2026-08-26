alter table public.contacts
  add column if not exists can_view_all_events boolean not null default false,
  add column if not exists can_manage_schedules boolean not null default false;

update public.contacts
set can_view_all_events = true
where can_manage_schedules = true
  and can_view_all_events = false;

alter table public.contacts
  drop constraint if exists contacts_manage_schedules_requires_global_view;

alter table public.contacts
  add constraint contacts_manage_schedules_requires_global_view
  check (not can_manage_schedules or can_view_all_events);

comment on column public.contacts.can_view_all_events is
  'Allows this member/staff contact to see the same global event agenda exposed in the member panel to admins.';

comment on column public.contacts.can_manage_schedules is
  'Allows this member/staff contact to open the scale builder from the member panel and save/send invitations.';
