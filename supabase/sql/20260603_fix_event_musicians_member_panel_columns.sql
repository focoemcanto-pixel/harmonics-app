-- Fix painel do membro/admin preview
-- O painel /membro buscava musician_name e snapshot_name em event_musicians.
-- Em bancos já existentes, essas colunas podem não existir e quebrar a tela com:
-- "column event_musicians.musician_name does not exist".
--
-- Migração segura e idempotente.

alter table if exists public.event_musicians
  add column if not exists musician_name text,
  add column if not exists snapshot_name text;

-- Preenche snapshots a partir do contato vinculado, sem sobrescrever valores já existentes.
update public.event_musicians em
set
  musician_name = coalesce(nullif(trim(em.musician_name), ''), c.name),
  snapshot_name = coalesce(nullif(trim(em.snapshot_name), ''), c.name)
from public.contacts c
where c.id = em.musician_id
  and (
    coalesce(nullif(trim(em.musician_name), ''), '') = ''
    or coalesce(nullif(trim(em.snapshot_name), ''), '') = ''
  );

create index if not exists event_musicians_musician_name_idx
  on public.event_musicians (musician_name);
