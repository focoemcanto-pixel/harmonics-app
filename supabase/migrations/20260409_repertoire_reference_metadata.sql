alter table if exists public.repertoire_items
  add column if not exists reference_title text,
  add column if not exists reference_channel text,
  add column if not exists reference_thumbnail text,
  add column if not exists reference_video_id text;

alter table if exists public.repertoire_config
  add column if not exists exit_reference_title text,
  add column if not exists exit_reference_channel text,
  add column if not exists exit_reference_thumbnail text,
  add column if not exists exit_reference_video_id text;
