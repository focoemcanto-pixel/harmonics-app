alter table public.invites
  add column if not exists sending_at timestamptz,
  add column if not exists sending_token text;

create index if not exists idx_invites_sending_lock
  on public.invites (event_id, sending_at)
  where sending_at is not null and whatsapp_sent_at is null;
