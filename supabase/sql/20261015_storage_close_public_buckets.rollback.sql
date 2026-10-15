-- Rollback de 20261015_storage_close_public_buckets.sql (restaura exatamente o estado anterior).
begin;

update storage.buckets set public = true where id in ('contract-pdfs', 'payment-proofs');

create policy "Public read contract pdfs" on storage.objects
  for select to public using (bucket_id = 'contract-pdfs');

create policy "Public read access for payment proofs" on storage.objects
  for select to public using (bucket_id = 'payment-proofs');

commit;
