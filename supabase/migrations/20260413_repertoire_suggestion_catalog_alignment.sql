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

-- IMPORTANTE:
-- Não sincronizar automaticamente repertoire_items -> suggestion_songs.
-- suggestion_songs é catálogo editorial e deve ser alimentado apenas pelo admin.
