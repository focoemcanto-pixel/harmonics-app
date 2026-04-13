alter table if exists public.suggestion_songs
  add column if not exists event_types text[] not null default '{}',
  add column if not exists moments text[] not null default '{}',
  add column if not exists styles text[] not null default '{}',
  add column if not exists moods text[] not null default '{}',
  add column if not exists priority_score integer not null default 0,
  add column if not exists is_recommended boolean not null default false,
  add column if not exists usage_count integer not null default 0;

alter table if exists public.repertoire_items
  add column if not exists suggestion_song_id uuid references public.suggestion_songs(id) on delete set null;

create index if not exists suggestion_songs_priority_idx
  on public.suggestion_songs (priority_score desc, usage_count desc, is_recommended desc);

create index if not exists suggestion_songs_event_types_gin_idx
  on public.suggestion_songs using gin (event_types);

create index if not exists suggestion_songs_moments_gin_idx
  on public.suggestion_songs using gin (moments);

create index if not exists suggestion_songs_styles_gin_idx
  on public.suggestion_songs using gin (styles);

create index if not exists suggestion_songs_moods_gin_idx
  on public.suggestion_songs using gin (moods);

create index if not exists repertoire_items_suggestion_song_idx
  on public.repertoire_items (suggestion_song_id);

create or replace function public.increment_suggestion_song_usage(p_song_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.suggestion_songs
  set usage_count = coalesce(usage_count, 0) + 1,
      updated_at = now()
  where id = p_song_id;
end;
$$;
