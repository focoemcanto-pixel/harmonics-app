alter table public.automation_rules
  add column if not exists delay_hours integer null;
