-- Storage Migration Engine
-- Objetivo:
-- preparar migração segura de assets legados para:
-- workspaces/{workspace_id}/...
--
-- IMPORTANTE:
-- Este script NÃO remove assets antigos.
-- Primeiro ele cria estrutura de rastreio/migração.

begin;

create table if not exists public.storage_asset_migrations (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  entity_type text not null,
  entity_id uuid not null,

  bucket_id text not null,

  old_path text not null,
  new_path text not null,

  old_public_url text,
  new_public_url text,

  migration_status text not null default 'pending',
  migration_error text,

  migrated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storage_asset_migrations_workspace_idx
  on public.storage_asset_migrations(workspace_id);

create index if not exists storage_asset_migrations_status_idx
  on public.storage_asset_migrations(migration_status);

create index if not exists storage_asset_migrations_entity_idx
  on public.storage_asset_migrations(entity_type, entity_id);

-- --------------------------------------------------
-- CONTRATOS
-- --------------------------------------------------
insert into public.storage_asset_migrations (
  workspace_id,
  entity_type,
  entity_id,
  bucket_id,
  old_path,
  new_path,
  old_public_url,
  migration_status
)
select
  c.workspace_id,
  'contract',
  c.id,
  'contract-pdfs',
  regexp_replace(c.pdf_url, '^.*?/object/public/contract-pdfs/', ''),
  concat(
    'workspaces/',
    c.workspace_id,
    '/contracts/',
    c.id,
    '/contrato-assinado.pdf'
  ),
  c.pdf_url,
  'pending'
from public.contracts c
where c.workspace_id is not null
  and c.pdf_url is not null
  and trim(c.pdf_url) <> ''
  and c.pdf_url not like 'workspaces/%'
  and not exists (
    select 1
    from public.storage_asset_migrations m
    where m.entity_type = 'contract'
      and m.entity_id = c.id
  );

-- --------------------------------------------------
-- COMPROVANTES
-- --------------------------------------------------
insert into public.storage_asset_migrations (
  workspace_id,
  entity_type,
  entity_id,
  bucket_id,
  old_path,
  new_path,
  old_public_url,
  migration_status
)
select
  p.workspace_id,
  'payment_proof',
  p.id,
  'payment-proofs',
  regexp_replace(p.proof_file_url, '^.*?/object/public/payment-proofs/', ''),
  concat(
    'workspaces/',
    p.workspace_id,
    '/payments/',
    p.id,
    '/proof'
  ),
  p.proof_file_url,
  'pending'
from public.payments p
where p.workspace_id is not null
  and p.proof_file_url is not null
  and trim(p.proof_file_url) <> ''
  and p.proof_file_url not like 'workspaces/%'
  and not exists (
    select 1
    from public.storage_asset_migrations m
    where m.entity_type = 'payment_proof'
      and m.entity_id = p.id
  );

commit;

-- --------------------------------------------------
-- CONSULTAS ÚTEIS
-- --------------------------------------------------

-- Resumo:
-- select migration_status, count(*)
-- from storage_asset_migrations
-- group by migration_status;

-- Pendentes:
-- select *
-- from storage_asset_migrations
-- where migration_status = 'pending'
-- order by created_at desc;
