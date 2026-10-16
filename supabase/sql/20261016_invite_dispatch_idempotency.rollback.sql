-- Rollback de supabase/migrations/20261016120000_invite_dispatch_idempotency.sql
-- Só executar depois de reverter o código que usa estas colunas (o código anterior
-- tolera a ausência de sending_* e de automation_logs.invite_id).
-- Atenção: apaga o histórico de lembretes de 5 dias (quais convites já receberam).

drop index if exists public.idx_automation_logs_invite_id;
alter table public.automation_logs drop column if exists invite_id;

drop index if exists public.idx_invites_reminder_5d_due;
alter table public.invites
  drop column if exists reminder_5d_last_error,
  drop column if exists reminder_5d_attempts,
  drop column if exists reminder_5d_sent_at,
  drop column if exists reminder_5d_claimed_at;

-- sending_at/sending_token já eram esperadas pelo código desde 20260603120000;
-- remova apenas se quiser voltar ao modo "schema legado" do lock.
-- drop index if exists public.idx_invites_sending_lock;
-- alter table public.invites drop column if exists sending_token, drop column if exists sending_at;

notify pgrst, 'reload schema';
