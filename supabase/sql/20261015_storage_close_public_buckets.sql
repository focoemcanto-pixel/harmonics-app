-- BE-1 / BE-2 — Fecha os buckets de arquivos (NÃO executado). Procedimento oficial: docs/saas/STORAGE_FECHAMENTO.md.
-- ATENÇÃO: o SQL Editor roda como `postgres`, que altera storage.buckets mas NÃO pode dropar policies de
-- storage.objects (dono: supabase_storage_admin). Remova as 2 policies pela tela Storage → Policies.
--
-- Pré-condições (todas verificadas antes do GO):
--   1. Código com os consumidores migrados (/api/public/files/contract/<token>,
--      /api/public/files/payment-proof/<token>/<id>, signed-url/download autenticados) em produção.
--   2. Portal do cliente, /contrato, /verify e "Abrir PDF/comprovante" do admin testados em produção.
-- Efeito:
--   - URLs /storage/v1/object/public/... deixam de responder (links antigos de WhatsApp/CSV p/ admin).
--   - Leitura/listagem com chave anon/authenticated deixa de funcionar (não há policy de leitura).
--   - O app continua lendo/assinando/gravando pelo service role (ignora RLS), sem mudança.
-- Rollback: supabase/sql/20261015_storage_close_public_buckets.rollback.sql

begin;

update storage.buckets set public = false where id in ('contract-pdfs', 'payment-proofs');

-- Nomes reais das policies em produção (pg_policies, 2026-10-15).
drop policy if exists "Public read contract pdfs" on storage.objects;
drop policy if exists "Public read access for payment proofs" on storage.objects;

commit;

-- Verificação:
-- select id, public from storage.buckets where id in ('contract-pdfs','payment-proofs');   -- ambos false
-- select policyname from pg_policies where schemaname='storage' and tablename='objects';  -- sem "Public read"
