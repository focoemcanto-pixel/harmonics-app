-- Convites de escala: idempotência do convite inicial e do lembrete de 5 dias,
-- e invite_id em automation_logs.
--
-- Somente aditiva (add column if not exists / create index if not exists).
-- Rollback: supabase/sql/20261016_invite_dispatch_idempotency.rollback.sql
--
-- 1) Lock do convite inicial. A migration 20260603120000 criou estas colunas no
--    código, mas nunca foi aplicada em produção: o lock caía no modo "schema
--    legado" e duas execuções concorrentes podiam enviar o mesmo convite.
alter table public.invites
  add column if not exists sending_at timestamptz,
  add column if not exists sending_token text;

create index if not exists idx_invites_sending_lock
  on public.invites (event_id, sending_at)
  where sending_at is not null and whatsapp_sent_at is null;

-- 2) Lembrete único de 5 dias (no máximo 1 por convite).
--    claimed_at é o lock atômico (UPDATE ... WHERE reminder_5d_claimed_at IS NULL);
--    sent_at marca o envio aceito pelo provider; attempts limita novas tentativas
--    após erro explícito do provider.
alter table public.invites
  add column if not exists reminder_5d_claimed_at timestamptz,
  add column if not exists reminder_5d_sent_at timestamptz,
  add column if not exists reminder_5d_attempts integer not null default 0,
  add column if not exists reminder_5d_last_error text;

create index if not exists idx_invites_reminder_5d_due
  on public.invites (status, whatsapp_sent_at)
  where status = 'pending' and reminder_5d_sent_at is null and reminder_5d_claimed_at is null;

-- 3) automation_logs.event_id referencia events.id; o ID do convite ia para essa
--    coluna e violava a FK (o log era perdido). O convite passa a ter coluna própria.
alter table public.automation_logs
  add column if not exists invite_id uuid references public.invites(id) on delete set null;

create index if not exists idx_automation_logs_invite_id
  on public.automation_logs (invite_id)
  where invite_id is not null;

notify pgrst, 'reload schema';
