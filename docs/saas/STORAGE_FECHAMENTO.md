# Fechamento dos buckets `contract-pdfs` e `payment-proofs` (BE-1/BE-2)

Estado em 2026-10-15: GO técnico. **Não executado** — aguarda autorização do dono.

## Por que pela tela de Policies
`storage.objects` pertence a `supabase_storage_admin`. O papel `postgres` (SQL Editor) consegue
alterar `storage.buckets`, mas **não** consegue `drop/create policy` em `storage.objects`.
Por isso: buckets por SQL; policies pela tela **Storage → Policies** do Dashboard.

## Fechamento (ordem)
1. SQL Editor (projeto `harmonics-saas-dev`):
   ```sql
   update storage.buckets set public = false where id = 'contract-pdfs';
   update storage.buckets set public = false where id = 'payment-proofs';
   ```
2. Dashboard → Storage → Policies → tabela `objects`:
   - excluir **`Public read contract pdfs`** (SELECT, public, `bucket_id = 'contract-pdfs'`);
   - excluir **`Public read access for payment proofs`** (SELECT, public, `bucket_id = 'payment-proofs'`).
3. Verificação (SQL Editor):
   ```sql
   select id, public from storage.buckets where id in ('contract-pdfs','payment-proofs');   -- ambos false
   select policyname from pg_policies where schemaname='storage' and tablename='objects';  -- nenhuma "Public read"
   ```
4. Teste rápido: abrir um PDF pelo portal e um comprovante pelo admin (devem abrir via `/object/sign/...`);
   uma URL antiga `/storage/v1/object/public/contract-pdfs/...` deve responder 400/404.

## Rollback (imediato, se algum fluxo quebrar)
1. SQL Editor:
   ```sql
   update storage.buckets set public = true where id in ('contract-pdfs', 'payment-proofs');
   ```
2. Dashboard → Storage → Policies → `objects` → New policy → "For full customization", para cada uma:
   - Nome `Public read contract pdfs` · Allowed operation **SELECT** · Target roles: (vazio = public) ·
     USING: `bucket_id = 'contract-pdfs'`
   - Nome `Public read access for payment proofs` · **SELECT** · roles public ·
     USING: `bucket_id = 'payment-proofs'`
   Definição idêntica à atual (PERMISSIVE, sem WITH CHECK), conferida em `pg_policies`.
   Equivalente SQL (se executado com papel com permissão sobre storage.objects):
   `supabase/sql/20261015_storage_close_public_buckets.rollback.sql`.

Somente o passo 1 (bucket público) já restaura todas as URLs `/object/public/...`; as policies
restauram também leitura/listagem via API com chave anon, que nenhum fluxo do app usa.

## O que deixa de funcionar ao fechar (aceito)
Links antigos com URL pública já enviados ao admin (WhatsApp "contrato assinado" antes de
2026-10-15 10:53 UTC) e CSVs exportados antes dessa data.
