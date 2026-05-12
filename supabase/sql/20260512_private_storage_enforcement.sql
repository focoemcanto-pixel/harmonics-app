-- Private Storage Enforcement
-- Objetivo:
-- endurecer acesso aos buckets multi-tenant.
--
-- Estratégia:
-- 1. impedir uploads fora de workspaces/{workspace_id}/...
-- 2. bloquear acesso público residual
-- 3. preparar uso obrigatório de signed URLs
--
-- IMPORTANTE:
-- Execute SOMENTE após validar migrações pendentes.

begin;

-- --------------------------------------------------
-- HELPER: validar prefixo workspace path
-- --------------------------------------------------

create or replace function public.storage_path_matches_workspace(
  object_name text,
  workspace uuid
)
returns boolean
language sql
immutable
as $$
  select object_name like ('workspaces/' || workspace::text || '/%');
$$;

-- --------------------------------------------------
-- STORAGE OBJECTS: policies privadas
-- --------------------------------------------------

-- Remove policies antigas genéricas, se existirem.
drop policy if exists "contract_pdfs_public_read" on storage.objects;
drop policy if exists "payment_proofs_public_read" on storage.objects;
drop policy if exists "contract_pdfs_authenticated_all" on storage.objects;
drop policy if exists "payment_proofs_authenticated_all" on storage.objects;

-- --------------------------------------------------
-- CONTRATOS
-- --------------------------------------------------

create policy "contract_pdfs_workspace_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'contract-pdfs'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and wm.workspace_id::text = split_part(name, '/', 2)
  )
);

create policy "contract_pdfs_workspace_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'contract-pdfs'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and wm.workspace_id::text = split_part(name, '/', 2)
  )
  and name like 'workspaces/%'
);

create policy "contract_pdfs_workspace_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'contract-pdfs'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and wm.workspace_id::text = split_part(name, '/', 2)
  )
)
with check (
  bucket_id = 'contract-pdfs'
  and name like 'workspaces/%'
);

-- --------------------------------------------------
-- COMPROVANTES
-- --------------------------------------------------

create policy "payment_proofs_workspace_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and wm.workspace_id::text = split_part(name, '/', 2)
  )
);

create policy "payment_proofs_workspace_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and wm.workspace_id::text = split_part(name, '/', 2)
  )
  and name like 'workspaces/%'
);

create policy "payment_proofs_workspace_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'payment-proofs'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = auth.uid()
      and wm.workspace_id::text = split_part(name, '/', 2)
  )
)
with check (
  bucket_id = 'payment-proofs'
  and name like 'workspaces/%'
);

commit;

-- --------------------------------------------------
-- PÓS-EXECUÇÃO MANUAL
-- --------------------------------------------------
-- 1. Tornar buckets privados no Supabase Dashboard.
-- 2. Validar geração de signed URLs.
-- 3. Confirmar que uploads antigos públicos já foram migrados.
