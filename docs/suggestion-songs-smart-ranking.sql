-- Query reutilizável para ranking inteligente no catálogo válido.
-- Catálogo válido:
--   source_type in ('admin', 'imported')
--   is_active = true

create or replace view public.suggestion_songs_smart_ranked as
select
  s.*,
  (
    coalesce(s.usage_count, 0) * 10
    + case when s.is_featured then 20 else 0 end
    + case when s.is_recommended then 15 else 0 end
    + case when s.source_type = 'imported' then 4 else 0 end
    + greatest(
        0,
        round(
          (
            (1 - least(60, greatest(0, extract(day from now() - s.created_at))) / 60)
            * 8
          )::numeric,
          2
        )
      )
  )::numeric(10,2) as smart_score
from public.suggestion_songs s
where s.is_active = true
  and s.source_type in ('admin', 'imported');

-- Exemplo de consumo:
-- select id, title, artist, smart_score
-- from public.suggestion_songs_smart_ranked
-- order by smart_score desc, usage_count desc, created_at desc
-- limit 50;
