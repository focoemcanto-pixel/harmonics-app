alter table if exists public.scale_templates
  add column if not exists compatible_tags text;

alter table if exists public.scale_templates
  add column if not exists suggestion_priority integer not null default 100;
