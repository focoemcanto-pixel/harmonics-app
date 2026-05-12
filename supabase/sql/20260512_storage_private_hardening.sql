-- Storage hardening para o multi-tenant Harmonics App
-- Execute em uma janela controlada depois de validar que o app já usa signed URLs.
-- Buckets alvo:
-- - contract-pdfs
-- - payment-proofs
--
-- Objetivo:
-- 1. Garantir que os buckets existam.
-- 2. Marcar buckets como privados.
-- 3. Remover políticas públicas antigas de leitura.
-- 4. Criar políticas de leitura por workspace para usuários autenticados.
-- 5. Manter escrita/geração centralizada pelo backend/service role.

begin;

insert into storage.buckets (id, name, public)
values
  ('contract-pdfs', 'contract-pdfs', false),
  ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update
set public = false;

-- Remove nomes comuns de políticas públicas/legadas se existirem.
drop policy if exists "Public read contract-pdfs" on storage.objects;
drop policy if exists "Allow public read contract-pdfs" on storage.objects;
drop policy if exists "contract-pdfs public read" on storage.objects;
drop policy if exists "Public read payment-proofs" on storage.objects;
drop policy if exists "Allow public read payment-proofs" on storage.objects;
drop policy if exists "payment-proofs public read" on storage.objects;

-- Leitura de contratos por workspace.
-- Espera paths no formato:
-- workspaces/{workspace_id}/contracts/{arquivo}
create policy if not exists "contract_pdfs_workspace_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'contract-pdfs'
  and current_user_is_workspace_admin(
    nullif(split_part(name, '/', 2), '')::uuid
  )
);

-- Leitura de comprovantes por workspace.
-- Espera paths no formato:
-- workspaces/{workspace_id}/events/{event_id}/payments/{arquivo}
create policy if not exists "payment_proofs_workspace_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and current_user_is_workspace_admin(
    nullif(split_part(name, '/', 2), '')::uuid
  )
);

commit;

-- Pós-validação recomendada:
-- select id, name, public from storage.buckets where id in ('contract-pdfs','payment-proofs');
-- select policyname, cmd, roles, qual from pg_policies where schemaname = 'storage' and tablename = 'objects';
