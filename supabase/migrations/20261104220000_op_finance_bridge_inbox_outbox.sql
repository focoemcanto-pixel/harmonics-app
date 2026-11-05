-- Finance bridge, additive and inert until the signed service endpoint is provisioned.
-- Existing events, contracts, payments, op_finance_ledger and op_finance_audit are untouched.
create table if not exists public.op_finance_bridge_receipts (
 workspace_id uuid not null references public.workspaces(id),
 hub_payment_key uuid not null,
 hub_transaction_id bigint,
 event_id uuid not null references public.events(id),
 ledger_id uuid not null unique references public.op_finance_ledger(id),
 amount_cents bigint not null check(amount_cents>0),
 occurred_on date not null,
 created_at timestamptz not null default now(),
 primary key(workspace_id,hub_payment_key)
);
create index if not exists op_finance_bridge_receipts_event on public.op_finance_bridge_receipts(workspace_id,event_id);
create table if not exists public.op_finance_bridge_outbox (
 ledger_id uuid primary key references public.op_finance_ledger(id),
 workspace_id uuid not null references public.workspaces(id),
 event_id uuid not null references public.events(id),
 kind text not null check(kind in ('receipt','reversal')),
 amount_cents bigint not null check(amount_cents>0),
 occurred_on date not null,
 reverses_id uuid,
 created_at timestamptz not null default now(),
 acknowledged_at timestamptz,
 hub_receipt_ref text,
 check ((kind='reversal')=(reverses_id is not null))
);
create index if not exists op_finance_bridge_outbox_pending
 on public.op_finance_bridge_outbox(workspace_id,created_at) where acknowledged_at is null;
alter table public.op_finance_bridge_receipts enable row level security;
alter table public.op_finance_bridge_outbox enable row level security;
revoke all on public.op_finance_bridge_receipts,public.op_finance_bridge_outbox from public,anon,authenticated;
grant all on public.op_finance_bridge_receipts,public.op_finance_bridge_outbox to service_role;

create or replace function public.op_finance_bridge_capture()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.kind in ('receipt','reversal') and
    (new.kind='reversal' or coalesce(new.origin,'')<>'foco_hub') then
   insert into public.op_finance_bridge_outbox
     (ledger_id,workspace_id,event_id,kind,amount_cents,occurred_on,reverses_id)
   values (new.id,new.workspace_id,new.event_id,new.kind,new.amount_cents,new.occurred_on,new.reverses_id);
 end if;
 return new;
end $$;
revoke execute on function public.op_finance_bridge_capture() from public,anon,authenticated;
drop trigger if exists op_finance_bridge_capture_insert on public.op_finance_ledger;
create trigger op_finance_bridge_capture_insert after insert on public.op_finance_ledger
for each row execute function public.op_finance_bridge_capture();

-- Applies exactly one Hub payment per shared UUID inside one Harmonics transaction.
-- Requires an exact event, active owner/finance membership and a valid contract amount.
-- No opening balance is invented; historical-in-opening must be explicit for same-day records.
create or replace function public.op_finance_bridge_receive(
 p_workspace uuid,p_actor uuid,p_payment_key uuid,p_event uuid,p_amount_cents bigint,
 p_occurred_on date,p_hub_transaction_id bigint,p_in_opening boolean default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 existing public.op_finance_bridge_receipts%rowtype;
 event_row public.events%rowtype;
 sheet public.op_finance_events%rowtype;
 opening public.op_finance_settings%rowtype;
 created public.op_finance_ledger%rowtype;
 cap bigint; received bigint;
begin
 if p_workspace is null or p_actor is null or p_payment_key is null or p_event is null
    or p_amount_cents is null or p_amount_cents<=0 or p_occurred_on is null
    or p_occurred_on>(now() at time zone 'America/Bahia')::date then
    raise exception 'Invalid bridge receipt';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text,0));
 select * into existing from public.op_finance_bridge_receipts
 where workspace_id=p_workspace and hub_payment_key=p_payment_key for update;
 if found then
   if existing.event_id is distinct from p_event or
      existing.amount_cents is distinct from p_amount_cents or
      existing.occurred_on is distinct from p_occurred_on or
      existing.hub_transaction_id is distinct from p_hub_transaction_id then
     raise exception 'Idempotency key reused with different receipt';
   end if;
   return jsonb_build_object('ok',true,'duplicate',true,'ledger_id',existing.ledger_id);
 end if;
 if not exists(select 1 from public.workspace_members
   where workspace_id=p_workspace and user_id=p_actor and status='active'
   and role in ('owner','admin','administrador','financeiro')) then
   raise exception 'Bridge actor lacks active financial membership';
 end if;
 select * into event_row from public.events where id=p_event and workspace_id=p_workspace;
 if not found or lower(coalesce(event_row.status,'')) in ('cancelled','canceled','cancelado') then
   raise exception 'Event unavailable or wrong workspace';
 end if;
 select * into sheet from public.op_finance_events where workspace_id=p_workspace and event_id=p_event;
 cap:=case when sheet.event_id is not null then sheet.contract_cents
           else round(coalesce(event_row.agreed_amount,0)*100)::bigint end;
 if cap<=0 then raise exception 'Contract amount needs explicit review'; end if;
 select coalesce(sum(l.amount_cents),0) into received from public.op_finance_ledger l
 where l.workspace_id=p_workspace and l.event_id=p_event and l.kind='receipt'
 and not exists(select 1 from public.op_finance_ledger r where r.reverses_id=l.id);
 if received+p_amount_cents>cap then raise exception 'Receipt exceeds remaining contract'; end if;
 select * into opening from public.op_finance_settings where workspace_id=p_workspace;
 if opening.workspace_id is not null and p_occurred_on=opening.opening_on and p_in_opening is null then
   raise exception 'Same-day opening balance requires explicit historical classification';
 end if;
 if opening.workspace_id is not null and p_occurred_on<opening.opening_on and p_in_opening=false then
   raise exception 'Pre-opening receipt must be included in opening balance';
 end if;
 insert into public.op_finance_ledger(
   workspace_id,event_id,kind,amount_cents,occurred_on,in_opening,method,origin,notes,created_by)
 values(p_workspace,p_event,'receipt',p_amount_cents,p_occurred_on,
   (opening.workspace_id is not null and p_occurred_on<opening.opening_on)
     or coalesce(p_in_opening,false),
   'bridge','foco_hub','Recebimento sincronizado do livro central FOCO',p_actor)
 returning * into created;
 insert into public.op_finance_bridge_receipts
   (workspace_id,hub_payment_key,hub_transaction_id,event_id,ledger_id,amount_cents,occurred_on)
 values(p_workspace,p_payment_key,p_hub_transaction_id,p_event,created.id,p_amount_cents,p_occurred_on);
 insert into public.op_finance_audit(request_id,workspace_id,actor_id,action,before_value,after_value)
 values(gen_random_uuid(),p_workspace,p_actor,'bridge_receipt',null,
   jsonb_build_object('hub_payment_key',p_payment_key,'hub_transaction_id',p_hub_transaction_id,
   'event_id',p_event,'ledger_id',created.id,'amount_cents',p_amount_cents,
   'occurred_on',p_occurred_on));
 return jsonb_build_object('ok',true,'duplicate',false,'ledger_id',created.id);
end $$;
revoke all on function public.op_finance_bridge_receive(uuid,uuid,uuid,uuid,bigint,date,bigint,boolean)
 from public,anon,authenticated;
grant execute on function public.op_finance_bridge_receive(uuid,uuid,uuid,uuid,bigint,date,bigint,boolean)
 to service_role;
