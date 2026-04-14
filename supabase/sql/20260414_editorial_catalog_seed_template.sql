-- Template seguro para restaurar catálogo editorial validado em public.suggestion_songs.
-- Uso recomendado:
-- 1) cole o JSON do catálogo validado no CTE "payload";
-- 2) execute em transação;
-- 3) valide contagens antes de commit.
--
-- Importante:
-- - Não escreve em repertoire_items.
-- - source_type fica fixo em 'admin' para separar de músicas do cliente.
-- - UPSERT por youtube_id quando existir; fallback por (normalized_title, normalized_artist).

begin;

with payload as (
  -- Substitua [] pela lista validada.
  -- Campos esperados por item:
  -- {
  --   "title": "A Dois",
  --   "artist": "Exemplo",
  --   "youtubeId": "abcdefghijk",
  --   "thumbnailUrl": "https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg",
  --   "description": "texto",
  --   "featured": true,
  --   "genre": "Gospel",
  --   "moment": "Cerimônia",
  --   "tags": ["alianças", "oração"]
  -- }
  select jsonb_array_elements('[]'::jsonb) as row
),
normalized as (
  select
    nullif(btrim(row->>'title'), '') as title,
    nullif(btrim(row->>'artist'), '') as artist,
    nullif(btrim(row->>'youtubeId'), '') as youtube_id,
    nullif(btrim(row->>'thumbnailUrl'), '') as thumbnail_url,
    nullif(btrim(row->>'description'), '') as description,
    coalesce((row->>'featured')::boolean, false) as is_featured,
    nullif(btrim(row->>'genre'), '') as genre_name,
    nullif(btrim(row->>'moment'), '') as moment_name,
    coalesce(row->'tags', '[]'::jsonb) as tags
  from payload
),
resolved as (
  select
    n.*,
    g.id as genre_id,
    m.id as moment_id
  from normalized n
  left join public.suggestion_genres g
    on lower(g.name) = lower(n.genre_name)
  left join public.suggestion_moments m
    on lower(m.name) = lower(n.moment_name)
  where n.title is not null
),
upsert_by_youtube as (
  insert into public.suggestion_songs (
    title,
    artist,
    genre_id,
    moment_id,
    youtube_id,
    thumbnail_url,
    description,
    is_featured,
    is_active,
    source_type,
    sort_order,
    updated_at
  )
  select
    r.title,
    r.artist,
    r.genre_id,
    r.moment_id,
    r.youtube_id,
    coalesce(r.thumbnail_url, case when r.youtube_id is not null then 'https://img.youtube.com/vi/' || r.youtube_id || '/hqdefault.jpg' end),
    r.description,
    r.is_featured,
    true,
    'admin',
    0,
    now()
  from resolved r
  where r.youtube_id is not null
  on conflict (youtube_id) do update
  set
    title = excluded.title,
    artist = excluded.artist,
    genre_id = excluded.genre_id,
    moment_id = excluded.moment_id,
    thumbnail_url = excluded.thumbnail_url,
    description = excluded.description,
    is_featured = excluded.is_featured,
    is_active = true,
    source_type = 'admin',
    updated_at = now()
  returning id, title, artist, youtube_id
),
upsert_by_text as (
  insert into public.suggestion_songs (
    title,
    artist,
    genre_id,
    moment_id,
    youtube_id,
    thumbnail_url,
    description,
    is_featured,
    is_active,
    source_type,
    sort_order,
    normalized_title,
    normalized_artist,
    updated_at
  )
  select
    r.title,
    r.artist,
    r.genre_id,
    r.moment_id,
    null,
    r.thumbnail_url,
    r.description,
    r.is_featured,
    true,
    'admin',
    0,
    lower(r.title),
    lower(coalesce(r.artist, '')),
    now()
  from resolved r
  where r.youtube_id is null
  on conflict (normalized_title, normalized_artist) do update
  set
    genre_id = excluded.genre_id,
    moment_id = excluded.moment_id,
    thumbnail_url = excluded.thumbnail_url,
    description = excluded.description,
    is_featured = excluded.is_featured,
    is_active = true,
    source_type = 'admin',
    updated_at = now()
  returning id, title, artist, youtube_id
)
select
  (select count(*) from upsert_by_youtube) as upserted_by_youtube,
  (select count(*) from upsert_by_text) as upserted_by_text;

-- Opcional: revisar e associar tags da lista validada.
-- Sugestão: popular public.suggestion_tags antes e depois inserir em suggestion_song_tags.

commit;
