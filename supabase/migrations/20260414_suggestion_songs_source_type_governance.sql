-- Governança de source_type para separar catálogo editorial e fluxo de revisão.

create table if not exists public.suggestion_song_source_review (
  suggestion_song_id uuid primary key references public.suggestion_songs(id) on delete cascade,
  current_source_type text,
  proposed_source_type text not null check (proposed_source_type in ('admin', 'imported', 'client')),
  review_notes text,
  reviewed_by text,
  reviewed_at timestamptz not null default now(),
  applied_at timestamptz
);

create or replace function public.get_suggestion_songs_null_audit()
returns table (
  id uuid,
  title text,
  artist text,
  youtube_id text,
  youtube_url text,
  thumbnail_url text,
  is_active boolean,
  created_at timestamptz,
  repertoire_links bigint,
  has_editorial_usage boolean,
  has_client_usage boolean,
  suggested_classification text
)
language sql
security definer
set search_path = public
as $$
  with null_candidates as (
    select
      ss.id,
      ss.title,
      ss.artist,
      ss.youtube_id,
      ss.youtube_url,
      ss.thumbnail_url,
      ss.is_active,
      ss.created_at,
      count(ri.id) as repertoire_links,
      bool_or(coalesce(ri.type, '') = 'smart_suggestion') as has_editorial_usage,
      bool_or(coalesce(ri.type, '') <> 'smart_suggestion') as has_client_usage
    from public.suggestion_songs ss
    left join public.repertoire_items ri on ri.suggestion_song_id = ss.id
    where ss.source_type is null or btrim(coalesce(ss.source_type, '')) = ''
    group by ss.id, ss.title, ss.artist, ss.youtube_id, ss.youtube_url, ss.thumbnail_url, ss.is_active, ss.created_at
  )
  select
    nc.id,
    nc.title,
    nc.artist,
    nc.youtube_id,
    nc.youtube_url,
    nc.thumbnail_url,
    nc.is_active,
    nc.created_at,
    nc.repertoire_links,
    nc.has_editorial_usage,
    nc.has_client_usage,
    case
      when nc.repertoire_links = 0 then 'review_admin_or_imported'
      when nc.has_client_usage and not nc.has_editorial_usage then 'candidate_client'
      when nc.has_editorial_usage and not nc.has_client_usage then 'candidate_imported'
      else 'needs_manual_review'
    end as suggested_classification
  from null_candidates nc
  order by nc.created_at desc nulls last;
$$;

grant execute on function public.get_suggestion_songs_null_audit() to authenticated;

drop view if exists public.suggestion_songs_editorial_catalog_v;
create view public.suggestion_songs_editorial_catalog_v as
select *
from public.suggestion_songs
where source_type in ('admin', 'imported');

drop view if exists public.suggestion_songs_client_catalog_v;
create view public.suggestion_songs_client_catalog_v as
select *
from public.suggestion_songs
where source_type = 'client';
