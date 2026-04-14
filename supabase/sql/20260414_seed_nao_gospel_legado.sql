-- Seed idempotente: músicas NÃO gospel localizadas no legado (commit fe19964)
-- Data: 2026-04-14

with payload as (
  select jsonb_array_elements(
    $$[
      {
        "title": "A Thousand Years",
        "artist": "Christina Perri",
        "genre": "Romântico",
        "moment": "Entrada",
        "youtubeId": "rtOvBOTyX00",
        "thumbnailUrl": "https://img.youtube.com/vi/rtOvBOTyX00/hqdefault.jpg",
        "description": "Uma das músicas mais escolhidas para entrada da noiva.",
        "featured": true
      },
      {
        "title": "Perfect",
        "artist": "Ed Sheeran",
        "genre": "Pop",
        "moment": "Entrada",
        "youtubeId": "2Vv-BfVoq4g",
        "thumbnailUrl": "https://img.youtube.com/vi/2Vv-BfVoq4g/hqdefault.jpg",
        "description": "Muito usada em versões acústicas e elegantes.",
        "featured": true
      },
      {
        "title": "Canon in D",
        "artist": "Pachelbel",
        "genre": "Clássico",
        "moment": "Cortejo",
        "youtubeId": "NlprozGcs80",
        "thumbnailUrl": "https://img.youtube.com/vi/NlprozGcs80/hqdefault.jpg",
        "description": "Clássico muito presente em cerimônias elegantes.",
        "featured": false
      },
      {
        "title": "Hallelujah",
        "artist": "Instrumental",
        "genre": "Instrumental",
        "moment": "Cerimônia",
        "youtubeId": "0VqTwnAuHws",
        "thumbnailUrl": "https://img.youtube.com/vi/0VqTwnAuHws/hqdefault.jpg",
        "description": "Boa escolha para momentos emocionantes da cerimônia.",
        "featured": true
      },
      {
        "title": "All of Me",
        "artist": "John Legend",
        "genre": "Romântico",
        "moment": "Saída",
        "youtubeId": "450p7goxZqg",
        "thumbnailUrl": "https://img.youtube.com/vi/450p7goxZqg/hqdefault.jpg",
        "description": "Muito escolhida para saída dos noivos.",
        "featured": false
      }
    ]$$::jsonb
  ) as row
), normalized as (
  select
    nullif(btrim(row->>'title'), '') as title,
    nullif(btrim(row->>'artist'), '') as artist,
    nullif(btrim(row->>'genre'), '') as genre_name,
    nullif(btrim(row->>'moment'), '') as moment_name,
    nullif(btrim(row->>'youtubeId'), '') as youtube_id,
    nullif(btrim(row->>'thumbnailUrl'), '') as thumbnail_url,
    nullif(btrim(row->>'description'), '') as description,
    coalesce((row->>'featured')::boolean, false) as is_featured
  from payload
), resolved as (
  select
    n.title,
    n.artist,
    n.youtube_id,
    coalesce(nullif(btrim(concat('https://www.youtube.com/watch?v=', n.youtube_id)), ''), null) as youtube_url,
    n.thumbnail_url,
    n.description,
    n.is_featured,
    g.id as genre_id,
    m.id as moment_id
  from normalized n
  left join public.suggestion_genres g on lower(g.name) = lower(n.genre_name)
  left join public.suggestion_moments m on lower(m.name) = lower(n.moment_name)
  where n.title is not null and n.youtube_id is not null
)
insert into public.suggestion_songs (
  title,
  artist,
  genre_id,
  moment_id,
  youtube_url,
  youtube_id,
  thumbnail_url,
  description,
  is_featured,
  is_active,
  source_type
)
select
  r.title,
  r.artist,
  r.genre_id,
  r.moment_id,
  r.youtube_url,
  r.youtube_id,
  r.thumbnail_url,
  r.description,
  r.is_featured,
  true,
  'admin'
from resolved r
on conflict (youtube_id)
do update set
  title = excluded.title,
  artist = excluded.artist,
  genre_id = excluded.genre_id,
  moment_id = excluded.moment_id,
  youtube_url = excluded.youtube_url,
  thumbnail_url = excluded.thumbnail_url,
  description = excluded.description,
  is_featured = excluded.is_featured,
  is_active = true,
  source_type = 'admin',
  updated_at = now();
