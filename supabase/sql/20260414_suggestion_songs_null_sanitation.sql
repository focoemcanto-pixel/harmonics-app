-- Governança e saneamento seguro de source_type em public.suggestion_songs.
-- Fluxo recomendado:
--   1) executar diagnóstico
--   2) revisar candidatos
--   3) aprovar IDs
--   4) aplicar UPDATE controlado

-- 1) Distribuição atual de source_type (inclui legado null)
select
  case
    when source_type is null then '__null__'
    when btrim(source_type) = '' then '__empty__'
    else source_type
  end as source_type_bucket,
  count(*) as total,
  count(*) filter (where is_active) as active
from public.suggestion_songs
group by 1
order by total desc;

-- 2) Diagnóstico de legado null com sinais de origem
with null_candidates as (
  select
    ss.id,
    ss.title,
    ss.artist,
    ss.youtube_id,
    ss.created_at,
    count(ri.id) as repertoire_links,
    bool_or(coalesce(ri.type, '') = 'smart_suggestion') as has_editorial_usage,
    bool_or(coalesce(ri.type, '') <> 'smart_suggestion') as has_client_usage
  from public.suggestion_songs ss
  left join public.repertoire_items ri on ri.suggestion_song_id = ss.id
  where ss.source_type is null
  group by ss.id, ss.title, ss.artist, ss.youtube_id, ss.created_at
)
select
  *,
  case
    when repertoire_links = 0 then 'review_admin_or_imported'
    when has_client_usage and not has_editorial_usage then 'candidate_client'
    when has_editorial_usage and not has_client_usage then 'candidate_imported'
    else 'needs_manual_review'
  end as suggested_classification
from null_candidates
order by created_at desc nulls last;

-- 3) MATERIALIZAR revisão manual (pré-update)
-- create table if not exists public.suggestion_song_source_review (
--   suggestion_song_id uuid primary key references public.suggestion_songs(id) on delete cascade,
--   current_source_type text,
--   proposed_source_type text check (proposed_source_type in ('admin', 'imported', 'client')),
--   review_notes text,
--   reviewed_by text,
--   reviewed_at timestamptz default now()
-- );

-- 4) Exemplo de carga de revisão (preencher após auditoria humana)
-- insert into public.suggestion_song_source_review
--   (suggestion_song_id, current_source_type, proposed_source_type, review_notes, reviewed_by)
-- values
--   ('<uuid>', null, 'client', 'Vem de repertório de cliente', 'admin@harmonics');

-- 5) UPDATE controlado (somente IDs aprovados na tabela de revisão)
-- update public.suggestion_songs ss
-- set source_type = rv.proposed_source_type,
--     updated_at = now()
-- from public.suggestion_song_source_review rv
-- where rv.suggestion_song_id = ss.id
--   and ss.source_type is null
--   and rv.proposed_source_type in ('admin', 'imported', 'client');

-- 6) Pós-check: garantir que legado null foi reduzido
-- select count(*) as remaining_null
-- from public.suggestion_songs
-- where source_type is null;
