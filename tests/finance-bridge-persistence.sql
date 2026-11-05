-- Synthetic PostgreSQL schema fixture. NEVER connect to production.
-- Run in an ephemeral postgres:16 CI service:
-- psql -v ON_ERROR_STOP=1 -f tests/finance-bridge-persistence.sql
\set ON_ERROR_STOP on
begin;
create role service_role noinherit;
create role anon noinherit;
create role authenticated noinherit;
create table public.workspaces(id uuid primary key);
create table public.events(
 id uuid primary key,workspace_id uuid not null references public.workspaces(id),
 status text,agreed_amount numeric(12,2)
);
create table public.workspace_members(
 workspace_id uuid,user_id uuid,status text,role text,
 primary key(workspace_id,user_id)
);
create table public.op_finance_settings(
 workspace_id uuid primary key,opening_on date,opening_cents bigint
);
create table public.op_finance_events(
 workspace_id uuid,event_id uuid primary key,contract_cents bigint,status text
);
create table public.op_finance_ledger(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,
 event_id uuid,cost_id uuid,kind text not null,amount_cents bigint not null,
 occurred_on date not null,in_opening boolean not null default false,
 method text,origin text,notes text,created_by uuid not null,
 reverses_id uuid unique,created_at timestamptz not null default now()
);
create table public.op_finance_audit(
 request_id uuid primary key,workspace_id uuid not null,actor_id uuid not null,
 action text, before_value jsonb,after_value jsonb,
 created_at timestamptz not null default now()
);
\ir ../supabase/migrations/20261104220000_op_finance_bridge_inbox_outbox.sql

do $$
declare
 w uuid:='00000000-0000-4000-8000-000000000001';
 other uuid:='00000000-0000-4000-8000-000000000002';
 e uuid:='00000000-0000-4000-8000-000000000003';
 actor uuid:='00000000-0000-4000-8000-000000000004';
 wrong_actor uuid:='00000000-0000-4000-8000-000000000005';
 key1 uuid:='00000000-0000-4000-8000-000000000006';
 key2 uuid:='00000000-0000-4000-8000-000000000007';
 key3 uuid:='00000000-0000-4000-8000-000000000008';
 movement uuid; rs jsonb; n integer;
begin
 insert into public.workspaces values(w),(other);
 insert into public.events values(e,w,'confirmed',3500);
 insert into public.workspace_members values(w,actor,'active','owner'),
   (other,wrong_actor,'active','owner');
 insert into public.op_finance_events(workspace_id,event_id,contract_cents,status)
 values(w,e,350000,'checked');
 insert into public.op_finance_settings values(w,(now() at time zone 'America/Bahia')::date-5,100000);
 rs:=public.op_finance_bridge_receive(w,actor,key1,e,80000,(now() at time zone 'America/Bahia')::date,101,false);
 if rs->>'ok'<>'true' or rs->>'duplicate'<>'false'
   then raise exception 'Initial receipt failed: %',rs; end if;
 movement:=(rs->>'ledger_id')::uuid;
 rs:=public.op_finance_bridge_receive(w,actor,key1,e,80000,(now() at time zone 'America/Bahia')::date,101,false);
 if rs->>'duplicate'<>'true' or (rs->>'ledger_id')::uuid<>movement
   then raise exception 'Idempotent replay failed: %',rs; end if;
 select count(*) into n from public.op_finance_ledger where event_id=e and kind='receipt';
 if n<>1 then raise exception 'Duplicate receipt recorded'; end if;
 select count(*) into n from public.op_finance_bridge_outbox where event_id=e;
 if n<>0 then raise exception 'Hub-origin receipt should not loop back'; end if;
 begin
  perform public.op_finance_bridge_receive(w,actor,key1,e,90000,(now() at time zone 'America/Bahia')::date,101,false);
  raise exception 'Idempotency payload mismatch was accepted';
 exception when others then
  if sqlerrm='Idempotency payload mismatch was accepted'
    then raise; end if;
 end;
 begin
  perform public.op_finance_bridge_receive(w,wrong_actor,key2,e,10000,(now() at time zone 'America/Bahia')::date,102,false);
  raise exception 'Cross-workspace member was accepted';
 exception when others then
  if sqlerrm='Cross-workspace member was accepted' then raise; end if;
 end;
 begin
  perform public.op_finance_bridge_receive(other,wrong_actor,key2,e,10000,(now() at time zone 'America/Bahia')::date,102,false);
  raise exception 'Cross-workspace event was accepted';
 exception when others then
  if sqlerrm='Cross-workspace event was accepted' then raise; end if;
 end;
 begin
  perform public.op_finance_bridge_receive(w,actor,key2,e,300000,(now() at time zone 'America/Bahia')::date,102,false);
  raise exception 'Overpayment was accepted';
 exception when others then
  if sqlerrm='Overpayment was accepted' then raise; end if;
 end;
 -- Simulate a second partial receipt that stays below the contractual value.
 rs:=public.op_finance_bridge_receive(w,actor,key2,e,120000,(now() at time zone 'America/Bahia')::date,102,false);
 if rs->>'ok'<>'true' then raise exception 'Partial payment rejected'; end if;
 select count(*) into n from public.op_finance_bridge_receipts;
 if n<>2 then raise exception 'Unexpected bridge receipts %',n; end if;
 -- Existing legacy ledger entries are not touched by the bridge.
 insert into public.op_finance_ledger(
 workspace_id,event_id,kind,amount_cents,occurred_on,created_by,origin)
 values(w,e,'receipt',30000,(now() at time zone 'America/Bahia')::date,actor,'legacy');
 select count(*) into n from public.op_finance_bridge_outbox
 where event_id=e and kind='receipt';
 if n<>1 then raise exception 'Native receipt failed to enqueue'; end if;
 -- A musician expense reversal must not enqueue a client refund.
 insert into public.op_finance_ledger(
  workspace_id,event_id,kind,amount_cents,occurred_on,created_by)
 values(w,e,'payment',9000,(now() at time zone 'America/Bahia')::date,actor) returning id into movement;
 insert into public.op_finance_ledger(
 workspace_id,event_id,kind,amount_cents,occurred_on,created_by,reverses_id)
 values(w,e,'reversal',9000,(now() at time zone 'America/Bahia')::date,actor,movement);
 select count(*) into n from public.op_finance_bridge_outbox
 where kind='reversal';
 if n<>0 then raise exception 'Musician reversal misclassified as receipt'; end if;
 -- A real receipt reversal DOES enqueue once.
 select id into movement from public.op_finance_ledger
 where event_id=e and kind='receipt' and origin='legacy';
 insert into public.op_finance_ledger(
 workspace_id,event_id,kind,amount_cents,occurred_on,created_by,reverses_id)
 values(w,e,'reversal',30000,(now() at time zone 'America/Bahia')::date,actor,movement);
 select count(*) into n from public.op_finance_bridge_outbox
 where kind='reversal';
 if n<>1 then raise exception 'Receipt reversal not captured'; end if;
 -- Same-day opening classification must be explicit (never guess).
 insert into public.op_finance_settings(workspace_id,opening_on,opening_cents)
 values(other,(now() at time zone 'America/Bahia')::date,0);
 insert into public.events values('00000000-0000-4000-8000-000000000009',other,'confirmed',500);
 begin
  perform public.op_finance_bridge_receive(other,wrong_actor,key3,
    '00000000-0000-4000-8000-000000000009',5000,(now() at time zone 'America/Bahia')::date,104,null);
  raise exception 'Ambiguous opening date accepted';
 exception when others then if sqlerrm='Ambiguous opening date accepted' then raise; end if;
 end;
 if not exists(select 1 from public.op_finance_audit where action='bridge_receipt')
 then raise exception 'No transaction audit'; end if;
 -- A populated bridge may NOT be automatically dropped by rollback.
 begin
  if exists(select 1 from public.op_finance_bridge_receipts) then
    raise exception 'Bridge has live references. Preserve state; disable endpoint and plan compensating migration.';
  end if;
  raise exception 'Rollback guard did not trigger';
 exception when others then
  if sqlerrm='Rollback guard did not trigger' then raise; end if;
 end;
 raise notice 'PASS Harmonics Finance Bridge: idempotency, partial, tenants, cap, reversal, outbox, opening, rollback guard';
end $$;
rollback;
