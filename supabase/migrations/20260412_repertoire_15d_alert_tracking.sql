alter table public.repertoire_config
  add column if not exists reminder_15d_whatsapp_sent_at timestamptz null;
