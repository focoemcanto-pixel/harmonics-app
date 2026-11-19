alter table public.payments add column if not exists proof_sha256 text
  check (proof_sha256 is null or proof_sha256 ~ '^[0-9a-f]{64}$');
create unique index if not exists payments_event_proof_digest
  on public.payments(workspace_id,event_id,proof_sha256) where proof_sha256 is not null;

alter table public.ai_payment_evidence add column if not exists payment_id uuid references public.payments(id);
alter table public.ai_payment_evidence add column if not exists reviewed_by uuid;

-- Called only after dashboard admin authentication and private media storage.
create or replace function public.ai_review_payment_proof(
  p_workspace uuid, p_message uuid, p_event uuid, p_actor uuid, p_cents bigint,
  p_day date, p_method text, p_digest text, p_path text
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  evidence public.ai_payment_evidence%rowtype;
  existing public.payments%rowtype;
  matches uuid[];
  contact text;
  event_phone text;
begin
  if p_actor is null or p_cents is null or p_cents not between 1 and 9999999999 or
     p_day is null or nullif(trim(p_method),'') is null or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_review';
  end if;
  if p_path is null or p_path !~ ('^workspaces/'||p_workspace||'/events/'||p_event||'/payments/'||p_digest||'\.(pdf|png|jpg|webp)$') then
    raise exception 'invalid_private_path';
  end if;
  select * into strict evidence from public.ai_payment_evidence
   where workspace_id=p_workspace and message_id=p_message for update;
  select regexp_replace(whatsapp_phone,'[^0-9]','','g') into strict event_phone
    from public.events where workspace_id=p_workspace and id=p_event for update;
  select regexp_replace(c.provider_chat_id,'[^0-9]','','g') into strict contact
    from public.ai_conversations c join public.ai_messages m on m.conversation_id=c.id and m.workspace_id=c.workspace_id
   where c.workspace_id=p_workspace and c.id=evidence.conversation_id and m.id=p_message
     and m.direction='inbound' and m.origin='customer' and m.provider_message_id=evidence.provider_message_id;
  if contact is null or event_phone is null or length(contact)<10 or contact<>event_phone then
    raise exception 'event_contact_mismatch';
  end if;
  if evidence.payment_id is not null then
    if evidence.event_id=p_event and evidence.amount_cents=p_cents and evidence.payment_on=p_day and exists(select 1 from public.payments prior where prior.id=evidence.payment_id and prior.workspace_id=p_workspace and prior.proof_sha256=p_digest and lower(prior.payment_method)=lower(p_method)) then
      return evidence.payment_id;
    end if;
    raise exception 'already_reviewed';
  end if;
  if evidence.status not in ('candidate','extracted','needs_review') then raise exception 'review_state_invalid'; end if;
  select * into existing from public.payments where workspace_id=p_workspace and event_id=p_event and proof_sha256=p_digest for update;
  if not found then
    select array_agg(id) into matches from public.payments
     where workspace_id=p_workspace and event_id=p_event and payment_date=p_day and amount=p_cents/100.0;
    if cardinality(matches)>1 then raise exception 'ambiguous_payment'; end if;
    if cardinality(matches)=1 then
      select * into strict existing from public.payments where id=matches[1] for update;
      if existing.proof_file_url is not null then raise exception 'attachment_review_required'; end if;
    end if;
  end if;
  if existing.id is not null then
    if existing.amount<>p_cents/100.0 or existing.payment_date is distinct from p_day or lower(existing.payment_method) is distinct from lower(p_method)
       or existing.status not in ('em_analise','pending','pendente','confirmed','confirmado','pago','paid') then raise exception 'payment_review_required'; end if;
    if existing.proof_file_url is null then
      update public.payments set proof_file_url=p_path,proof_sha256=p_digest where id=existing.id;
    end if;
  else
    insert into public.payments(workspace_id,event_id,amount,payment_method,payment_date,proof_file_url,proof_sha256,status,notes)
      values(p_workspace,p_event,p_cents/100.0,p_method,p_day,p_path,p_digest,'em_analise','Comprovante recebido pelo WhatsApp')
      returning * into existing;
  end if;
  -- A repeated media digest can belong to another source message. The unique
  -- payments index already identifies the receipt; keep the evidence owner.
  update public.ai_payment_evidence set payment_id=existing.id,event_id=p_event,amount_cents=p_cents,payment_on=p_day,
    evidence_sha256=case when exists(select 1 from public.ai_payment_evidence other where other.workspace_id=p_workspace and other.id<>evidence.id and other.evidence_sha256=p_digest)
                         then null else p_digest end, reviewed_by=p_actor,status='matched' where id=evidence.id;
  return existing.id;
end $$;
revoke all on function public.ai_review_payment_proof(uuid,uuid,uuid,uuid,bigint,date,text,text,text) from public,anon,authenticated;
grant execute on function public.ai_review_payment_proof(uuid,uuid,uuid,uuid,bigint,date,text,text,text) to service_role;
