-- Governança e saneamento seguro de source_type em public.suggestion_songs.
-- Fluxo recomendado:
--   1) executar diagnóstico
--   2) revisar candidatos
--   3) aprovar IDs
--   4) aplicar UPDATE controlado
--   5) remover fallback source_type.is.null das queries de catálogo

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
select *
from public.get_suggestion_songs_null_audit();

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

-- 7) Pós-saneamento: catálogos separados por visão
-- select count(*) from public.suggestion_songs_editorial_catalog_v; -- admin + imported
-- select count(*) from public.suggestion_songs_client_catalog_v;    -- client
