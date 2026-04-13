-- Sugestões / Curadoria musical
-- Estrutura mínima para manter o módulo /sugestoes funcional.

create extension if not exists pgcrypto;

create table if not exists public.suggestion_genres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suggestion_moments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suggestion_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suggestion_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suggestion_songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text null,
  music_key text null,
  genre_id uuid null references public.suggestion_genres(id) on delete set null,
  moment_id uuid null references public.suggestion_moments(id) on delete set null,
  youtube_url text null,
  youtube_id text null,
  thumbnail_url text null,
  description text null,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suggestion_song_tags (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.suggestion_songs(id) on delete cascade,
  tag_id uuid not null references public.suggestion_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (song_id, tag_id)
);

create table if not exists public.suggestion_collection_songs (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.suggestion_collections(id) on delete cascade,
  song_id uuid not null references public.suggestion_songs(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (collection_id, song_id)
);

create index if not exists suggestion_songs_sort_idx
  on public.suggestion_songs (sort_order, created_at desc);
create index if not exists suggestion_songs_genre_idx
  on public.suggestion_songs (genre_id);
create index if not exists suggestion_songs_moment_idx
  on public.suggestion_songs (moment_id);

create index if not exists suggestion_song_tags_song_idx
  on public.suggestion_song_tags (song_id);
create index if not exists suggestion_collection_songs_song_idx
  on public.suggestion_collection_songs (song_id);
