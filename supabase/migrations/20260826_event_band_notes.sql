alter table public.events
  add column if not exists band_notes text,
  add column if not exists band_notes_updated_at timestamp with time zone,
  add column if not exists band_notes_updated_by text;

comment on column public.events.band_notes is
  'Operational instructions for the band/musicians for this event.';
comment on column public.events.band_notes_updated_at is
  'Last update timestamp for operational band notes.';
comment on column public.events.band_notes_updated_by is
  'Name/email of the admin or delegated schedule manager who last updated band notes.';
