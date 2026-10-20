-- Transactional integration QA: synthetic rows only; always rollback.
begin;
do $$
declare
 w uuid; customer uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); pid uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid();
 c contracts; r contract_revisions; r2 contract_revisions; s jsonb; original jsonb; blocked boolean:=false;
begin
 select id into strict w from workspaces where name='Banda teste' limit 1;
 insert into contacts(id,workspace_id,name,email,is_active) values(customer,w,'QA REVISION CUSTOMER','qa-revision@example.invalid',true);
 insert into events(id,workspace_id,client_contact_id,client_name,event_date,formation,instruments,agreed_amount,paid_amount,open_amount,status)
 values(eid,w,customer,'QA REVISION EVENT','2027-10-20','Duo','Voz, Teclado',1200,500,700,'Confirmado');
 insert into precontracts(id,workspace_id,event_id,contact_id,client_name,event_date,status,formation,instruments,agreed_amount,custom_contract_rich_html)
 values(pid,w,eid,customer,'QA REVISION PRECONTRACT','2027-10-20','signed','Duo','Voz, Teclado',1200,'<p>{{formation}}</p>');
 insert into contracts(id,workspace_id,precontract_id,event_id,contact_id,status,signed_at,pdf_url,signed_html,document_hash,raw_payload)
 values(cid,w,pid,eid,customer,'signed',now(), 'https://example.invalid/v1.pdf','<p>Duo assinado V1</p>','qa-v1',jsonb_build_object('precontract_snapshot',(select to_jsonb(x) from precontracts x where x.id=pid),'client_form',jsonb_build_object('full_name','QA CUSTOMER','cpf','52998224725'),'signed_contract_html','<p>Duo assinado V1</p>')) returning * into c;
 original:=to_jsonb(c);
 update precontracts set agreed_amount=2000,client_name='MUTATED AFTER SIGNING',event_date='2028-12-31' where id=pid;
 insert into payments(event_id,workspace_id,amount,status) values(eid,w,500,'paid');
 insert into event_musicians(event_id,musician_id,role,status) values(eid,customer,'Voz','confirmed');
 select to_jsonb(p) into s from precontracts p where id=pid;
 s:=s||jsonb_build_object('revision_client_form',jsonb_build_object('full_name','QA CUSTOMER','cpf','52998224725','event_date','2027-11-21','accepted_terms',false),'event_date','2027-11-21','agreed_amount',2000,'formation','Trio','instruments','Voz, Violino, Teclado','reception_formation','Quarteto','reception_instruments','Voz, Violino, Cajón, Violão','reception_hours',2,
   'service_specs','[{"id":"primary","kind":"primary","label":"Cerimônia","formation":"Trio","roles":["Voz","Violino","Teclado"],"duration_minutes":60},{"id":"reception","kind":"reception","label":"Receptivo","formation":"Quarteto","roles":["Voz","Violino","Cajón","Violão"],"duration_minutes":120}]'::jsonb);
 r:=create_contract_revision(cid,w,null,s,'<p>{{formation}}</p>','<p>Trio e Quarteto · 2h</p>','[{"field":"Formação","before":"Duo","after":"Trio"}]',c.updated_at);
 assert r.version=2 and r.status='pending' and r.financial_review_required;
 assert r.client_form->>'event_date'='2027-11-21' and (r.client_form->>'accepted_terms')::boolean=false;
 assert not (r.snapshot ? 'revision_client_form');
 assert (select formation='Duo' and agreed_amount=1200 from events where id=eid),'Pending changed active event';
 assert (select signed_record=original from contract_revisions where contract_id=cid and version=1),'V1 evidence differs';
 assert (select snapshot->>'event_date'='2027-10-20' and snapshot->>'client_name'='QA CUSTOMER' from contract_revisions where contract_id=cid and version=1),'V1 snapshot used later mutable data';
 begin perform create_contract_revision(cid,w,null,s,'source','html','[]',c.updated_at); exception when others then blocked:=true; end;
 assert blocked,'Multiple pending revisions were allowed';blocked:=false;
 update contract_revisions set status='cancelled' where id=r.id;
 r:=create_contract_revision(cid,w,null,s,'<p>{{formation}}</p>','<p>Trio e Quarteto · 2h</p>','[]',c.updated_at);
 assert r.version=3 and r.base_version=1,'Cancelled revision broke base version';
 begin perform complete_contract_revision(r.id,'STALE','signed','url','hash','{}'); exception when others then blocked:=true;end;
 assert blocked,'Stale HTML signed';blocked:=false;
 r2:=complete_contract_revision(r.id,r.preview_html,'<p>Trio e Quarteto V3 ASSINADO</p>','https://example.invalid/v3.pdf','qa-v3',jsonb_build_object('signed_at_utc',now(),'signer_name','QA CUSTOMER','verification_token',r.public_token));
 assert r2.status='signed' and r2.financial_review_required;
 assert (select raw_payload->'client_form'->>'event_date'='2027-11-21' and (raw_payload->'client_form'->>'accepted_terms')::boolean from contracts where id=cid);
 assert (select count(*)=1 from events where id=eid),'Event duplicated';
 assert (select event_id=eid and contact_id=customer and precontract_id=pid from contracts where id=cid),'Identity changed';
 assert (select formation='Trio' and reception_formation='Quarteto' and paid_amount=500 and agreed_amount=2000 and open_amount=1500 from events where id=eid),'Finance/service promotion incorrect';
 assert (select count(*)=1 and sum(amount)=500 from payments where event_id=eid),'Payments changed or duplicated';
 assert (select count(*)=1 and min(status)='confirmed' from event_musicians where event_id=eid),'Scale changed';
 assert (select signed_record=original and pdf_url='https://example.invalid/v1.pdf' from contract_revisions where contract_id=cid and version=1),'Previous evidence destroyed';
 begin update contract_revisions set signed_html='tampered' where contract_id=cid and version=1;exception when others then blocked:=true;end;
 assert blocked,'Signed history mutable';
 r:=complete_contract_revision(r2.id,r2.preview_html,'retry','retry','retry','{}');assert r.pdf_url=r2.pdf_url,'Signature replay changed evidence';
 assert not has_table_privilege('anon','contract_revisions','SELECT');
 assert not has_function_privilege('authenticated','public.complete_contract_revision(uuid,text,text,text,text,jsonb)','EXECUTE');
end $$;
rollback;
select 'PASS: A-H database invariants, pending isolation, cancellation/retry, stale HTML, immutable history, payments/scale preserved; all fixtures rolled back' as result;
