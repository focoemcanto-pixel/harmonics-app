-- Harmonics: tom operacional por música do repertório.
-- Campo compartilhado entre todos os membros que acessam o evento.

alter table if exists public.repertoire_items
  add column if not exists musical_key text;

comment on column public.repertoire_items.musical_key is
  'Tom musical operacional definido pela banda para a execução da música (ex.: B, C, F#, Bb, Am).';
