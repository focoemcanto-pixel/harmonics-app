-- Synthetic transaction on the disposable CI database.
begin;
do $$
declare
  w uuid := gen_random_uuid(); e uuid; c uuid; m uuid; p uuid; again uuid;
  actor uuid := gen_random_uuid(); digest text := repeat('a',64); path text;
begin
  insert into public.workspaces(id,key,name,slug) values(w,'proof-test','Synthetic','proof-test');
  insert into public.events(workspace_id,client_name,event_date,whatsapp_phone)
    values(w,'Synthetic','2099-01-01','12025550123') returning id into e;
  insert into public.ai_conversations(workspace_id,provider_chat_id) values(w,'12025550123') returning id into c;
  insert into public.ai_messages(workspace_id,conversation_id,provider_message_id,direction,sender_type,origin,message_type)
    values(w,c,'synthetic-proof','inbound','customer','customer','image') returning id into m;
  insert into public.ai_payment_evidence(workspace_id,conversation_id,message_id,provider_message_id,media_kind)
    values(w,c,m,'synthetic-proof','image');
  path := 'workspaces/'||w||'/events/'||e||'/payments/'||digest||'.png';
  p := public.ai_review_payment_proof(w,m,e,actor,2381,'2099-01-01','pix',digest,path);
  again := public.ai_review_payment_proof(w,m,e,actor,2381,'2099-01-01','pix',digest,path);
  if p is null or p<>again or (select count(*) from public.payments where event_id=e)<>1
    or not exists(select 1 from public.payments where id=p and status='em_analise' and amount=23.81)
    then raise exception 'pending receipt replay failed'; end if;
  if has_function_privilege('authenticated','public.ai_review_payment_proof(uuid,uuid,uuid,uuid,bigint,date,text,text,text)','EXECUTE')
    then raise exception 'unexpected client execution privilege'; end if;
end $$;
rollback;
