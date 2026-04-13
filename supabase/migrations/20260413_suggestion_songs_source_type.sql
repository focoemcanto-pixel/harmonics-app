-- Separa catálogo editorial (admin) de itens vindos de repertório/importações.

alter table if exists public.suggestion_songs
  add column if not exists source_type text;

update public.suggestion_songs
set source_type = coalesce(nullif(btrim(source_type), ''), 'admin');

with inferred_imported as (
  select ss.id
  from public.suggestion_songs ss
  join public.repertoire_items ri on ri.suggestion_song_id = ss.id
  group by ss.id
  having bool_or(coalesce(ri.type, '') <> 'smart_suggestion')
     and not bool_or(coalesce(ri.type, '') = 'smart_suggestion')
)
update public.suggestion_songs ss
set source_type = 'imported'
from inferred_imported ii
where ss.id = ii.id
  and coalesce(ss.source_type, 'admin') = 'admin';

alter table if exists public.suggestion_songs
  alter column source_type set default 'admin';

alter table if exists public.suggestion_songs
  alter column source_type set not null;

alter table if exists public.suggestion_songs
  drop constraint if exists suggestion_songs_source_type_check;

alter table if exists public.suggestion_songs
  add constraint suggestion_songs_source_type_check
  check (source_type in ('admin', 'imported', 'client'));

create index if not exists suggestion_songs_source_type_idx
  on public.suggestion_songs (source_type, is_active, sort_order, created_at desc);
