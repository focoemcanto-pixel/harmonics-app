-- Alinha catálogo global de músicas com repertório de eventos.
-- Objetivo: suggestion_songs vira fonte principal, repertoire_items referencia catálogo.

create extension if not exists pgcrypto;

alter table if exists public.suggestion_songs
  add column if not exists normalized_title text generated always as (lower(btrim(coalesce(title, '')))) stored,
  add column if not exists normalized_artist text generated always as (lower(btrim(coalesce(artist, '')))) stored;

create unique index if not exists suggestion_songs_youtube_id_uniq_idx
  on public.suggestion_songs (youtube_id)
  where youtube_id is not null and btrim(youtube_id) <> '';

create unique index if not exists suggestion_songs_title_artist_uniq_idx
  on public.suggestion_songs (normalized_title, normalized_artist)
  where (youtube_id is null or btrim(youtube_id) = '');

alter table if exists public.repertoire_items
  add column if not exists suggestion_song_id uuid null references public.suggestion_songs(id) on delete set null;

create index if not exists repertoire_items_suggestion_song_idx
  on public.repertoire_items (suggestion_song_id);

with source_rows as (
  select distinct
    btrim(coalesce(ri.song_name, '')) as title,
    nullif(btrim(coalesce(ri.artists, '')), '') as artist,
    nullif(btrim(coalesce(ri.reference_link, '')), '') as youtube_url,
    nullif(btrim(coalesce(ri.reference_video_id, '')), '') as youtube_id,
    nullif(btrim(coalesce(ri.reference_title, '')), '') as description,
    max(coalesce(ri.created_at, now())) over () as created_at
  from public.repertoire_items ri
  where btrim(coalesce(ri.song_name, '')) <> ''
),
inserted as (
  insert into public.suggestion_songs (
    title,
    artist,
    youtube_url,
    youtube_id,
    description,
    is_active,
    sort_order,
    created_at,
    updated_at
  )
  select
    s.title,
    s.artist,
    s.youtube_url,
    s.youtube_id,
    s.description,
    true,
    0,
    now(),
    now()
  from source_rows s
  on conflict (youtube_id)
  where youtube_id is not null and btrim(youtube_id) <> ''
  do update set
    title = excluded.title,
    artist = coalesce(public.suggestion_songs.artist, excluded.artist),
    youtube_url = coalesce(public.suggestion_songs.youtube_url, excluded.youtube_url),
    updated_at = now()
  returning id
)
insert into public.suggestion_songs (
  title,
  artist,
  youtube_url,
  youtube_id,
  description,
  is_active,
  sort_order,
  created_at,
  updated_at
)
select
  s.title,
  s.artist,
  s.youtube_url,
  null,
  s.description,
  true,
  0,
  now(),
  now()
from source_rows s
where s.youtube_id is null
on conflict (normalized_title, normalized_artist)
do update set
  youtube_url = coalesce(public.suggestion_songs.youtube_url, excluded.youtube_url),
  updated_at = now();

update public.repertoire_items ri
set suggestion_song_id = ss.id
from public.suggestion_songs ss
where ri.suggestion_song_id is null
  and (
    (
      nullif(btrim(coalesce(ri.reference_video_id, '')), '') is not null
      and ss.youtube_id = nullif(btrim(coalesce(ri.reference_video_id, '')), '')
    )
    or (
      nullif(btrim(coalesce(ri.reference_video_id, '')), '') is null
      and ss.normalized_title = lower(btrim(coalesce(ri.song_name, '')))
      and ss.normalized_artist = lower(btrim(coalesce(ri.artists, '')))
    )
  );
