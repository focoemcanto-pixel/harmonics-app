-- Archive legacy V1 from signing-time evidence, never a later mutable precontract.
create or replace function public.create_contract_revision(p_contract uuid, p_workspace uuid, p_actor uuid,
  p_snapshot jsonb, p_source text, p_html text, p_changes jsonb, p_expected_updated_at timestamptz)
returns public.contract_revisions language plpgsql security invoker set search_path = public as $$
declare c public.contracts; p public.precontracts; r public.contract_revisions; v integer; b integer; signing_snapshot jsonb; signing_form jsonb;
begin
  select * into strict c from contracts where id=p_contract and workspace_id=p_workspace for update;
  if c.status <> 'signed' or c.signed_at is null then raise exception 'Contrato precisa estar assinado'; end if;
  if c.updated_at is distinct from p_expected_updated_at then raise exception 'Contrato mudou. Recarregue antes de revisar'; end if;
  select * into strict p from precontracts where id=c.precontract_id and workspace_id=p_workspace for update;
  if exists(select 1 from contract_revisions where contract_id=c.id and status='pending') then raise exception 'Já existe revisão pendente'; end if;
  signing_snapshot := case when jsonb_typeof(c.raw_payload->'precontract_snapshot')='object' then c.raw_payload->'precontract_snapshot' else to_jsonb(p) end;
  signing_form := coalesce(c.raw_payload->'client_form','{}');
  signing_snapshot := signing_snapshot || jsonb_strip_nulls(jsonb_build_object(
    'client_name',nullif(signing_form->>'full_name',''),
    'event_date',nullif(signing_form->>'event_date',''),
    'event_time',nullif(signing_form->>'event_time',''),
    'location_name',nullif(signing_form->>'event_location_name',''),
    'location_address',nullif(signing_form->>'event_location_address','')));
  -- No migration of existing evidence: archive lazily, byte-for-byte, on first revision.
  insert into contract_revisions(contract_id,workspace_id,version,status,snapshot,client_form,source_html,signed_record,signed_html,pdf_url,document_hash,signature_metadata,signed_at,verification_token)
  values(c.id,p_workspace,1,'signed',signing_snapshot,signing_form,coalesce(nullif(c.raw_payload->>'contract_source_html',''),nullif(signing_snapshot->>'custom_contract_rich_html',''),nullif(signing_snapshot->>'custom_contract_content',''),''),to_jsonb(c),coalesce(c.signed_html,c.raw_payload->>'signed_contract_html'),c.pdf_url,c.document_hash,coalesce(c.signature_metadata,c.raw_payload->'signature_metadata'),c.signed_at,
    coalesce(c.signature_metadata->>'verification_token',c.signature_metadata->>'validation_token',c.verification_token,c.public_token))
  on conflict (contract_id,version) do nothing;
  select max(version) into v from contract_revisions where contract_id=c.id;
  select max(version) into b from contract_revisions where contract_id=c.id and status='signed';
  insert into contract_revisions(contract_id,workspace_id,version,base_version,status,snapshot,client_form,source_html,preview_html,changes,created_by,financial_review_required)
  values(c.id,p_workspace,v+1,b,'pending',p_snapshot-'revision_client_form',coalesce(p_snapshot->'revision_client_form',c.raw_payload->'client_form','{}'),p_source,p_html,p_changes,p_actor,
    (coalesce((p_snapshot->>'agreed_amount')::numeric,0) <> coalesce(p.agreed_amount,0)) or exists(select 1 from contract_revisions where contract_id=c.id and status='signed' and financial_review_required)) returning * into r;
  return r;
end $$;

