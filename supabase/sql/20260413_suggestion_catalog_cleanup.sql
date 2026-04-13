-- Limpeza controlada de contaminação no catálogo editorial.
-- Execute em etapas (SELECT -> UPDATE/DELETE) e valide antes de confirmar.

-- 1) Diagnóstico: candidatos contaminados (apenas repertório livre de cliente/importado)
with contaminated_candidates as (
  select
    ss.id,
    ss.title,
    ss.artist,
    ss.youtube_id,
    ss.source_type,
    count(*) as linked_items,
    bool_or(coalesce(ri.type, '') = 'smart_suggestion') as has_smart_usage,
    bool_or(coalesce(ri.type, '') <> 'smart_suggestion') as has_client_usage,
    min(ri.created_at) as first_linked_at,
    max(ri.created_at) as last_linked_at
  from public.suggestion_songs ss
  join public.repertoire_items ri on ri.suggestion_song_id = ss.id
  group by ss.id, ss.title, ss.artist, ss.youtube_id, ss.source_type
)
select *
from contaminated_candidates
where has_client_usage = true
  and has_smart_usage = false
order by last_linked_at desc;

-- 2) Marcar como imported (preserva histórico sem exibir no /sugestoes)
-- update public.suggestion_songs ss
-- set source_type = 'imported',
--     updated_at = now()
-- where ss.id in (
--   with contaminated_candidates as (
--     select ss2.id
--     from public.suggestion_songs ss2
--     join public.repertoire_items ri on ri.suggestion_song_id = ss2.id
--     group by ss2.id
--     having bool_or(coalesce(ri.type, '') <> 'smart_suggestion')
--        and not bool_or(coalesce(ri.type, '') = 'smart_suggestion')
--   )
--   select id from contaminated_candidates
-- );

-- 3) (Opcional) Desvincular do repertório para remoção completa do catálogo
-- update public.repertoire_items ri
-- set suggestion_song_id = null
-- where ri.suggestion_song_id in (
--   select ss.id
--   from public.suggestion_songs ss
--   where ss.source_type in ('imported', 'client')
-- );

-- 4) (Opcional) Excluir definitivamente do catálogo
-- delete from public.suggestion_songs ss
-- where ss.source_type in ('imported', 'client');
