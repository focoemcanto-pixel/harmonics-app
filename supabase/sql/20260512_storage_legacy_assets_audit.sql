-- Auditoria de assets legados no Storage
-- Execute antes de tornar buckets privados definitivamente.
-- Objetivo: identificar objetos e registros que ainda não seguem o padrão:
-- workspaces/{workspace_id}/...

-- 1. Objetos em buckets sensíveis fora do padrão workspace.
select
  bucket_id,
  name,
  owner,
  created_at,
  updated_at,
  metadata
from storage.objects
where bucket_id in ('contract-pdfs', 'payment-proofs')
  and name not like 'workspaces/%'
order by bucket_id, created_at desc;

-- 2. Contratos com pdf_url fora do padrão workspace path.
select
  id,
  workspace_id,
  precontract_id,
  event_id,
  status,
  pdf_url,
  created_at
from contracts
where pdf_url is not null
  and trim(pdf_url) <> ''
  and pdf_url not like 'workspaces/%'
order by created_at desc;

-- 3. Pagamentos com proof_file_url fora do padrão workspace path.
select
  id,
  workspace_id,
  event_id,
  status,
  proof_file_url,
  created_at
from payments
where proof_file_url is not null
  and trim(proof_file_url) <> ''
  and proof_file_url not like 'workspaces/%'
order by created_at desc;

-- 4. Repertórios com PDF/export antigo, se existir coluna.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'repertoire_config'
      and column_name = 'repertoire_pdf_url'
  ) then
    raise notice 'Execute manualmente: select id, event_id, repertoire_pdf_url from repertoire_config where repertoire_pdf_url is not null and trim(repertoire_pdf_url) <> '''' and repertoire_pdf_url not like ''workspaces/%%'';';
  else
    raise notice 'Coluna repertoire_pdf_url não existe em repertoire_config neste schema.';
  end if;
end $$;

-- 5. Resumo por bucket.
select
  bucket_id,
  count(*) filter (where name like 'workspaces/%') as workspace_scoped,
  count(*) filter (where name not like 'workspaces/%') as legacy_unscoped,
  count(*) as total
from storage.objects
where bucket_id in ('contract-pdfs', 'payment-proofs')
group by bucket_id
order by bucket_id;
