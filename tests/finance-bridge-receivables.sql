-- Sintético e revertido. NUNCA conectar em produção. Usa as migrations reais do caixa operacional
-- e da ponte, mais a desta mudança.
\set ON_ERROR_STOP on
begin;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role noinherit;end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon noinherit;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated noinherit;end if;
end $$;
create table public.workspaces(id uuid primary key default gen_random_uuid());
create table public.workspace_members(workspace_id uuid,user_id uuid,role text,status text,primary key(workspace_id,user_id));
create table public.events(id uuid primary key default gen_random_uuid(),workspace_id uuid not null,client_name text,event_date date,status text,agreed_amount numeric(10,2));
create table public.contracts(id uuid primary key default gen_random_uuid(),event_id uuid,signed_at timestamptz,signed_html text);
create table public.payments(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id) on delete cascade,amount numeric(10,2) not null default 0,payment_method text,payment_date date,status text not null default 'pending',notes text,due_date date,workspace_id uuid not null);
create table public.event_musicians(id uuid primary key default gen_random_uuid(),event_id uuid);
\ir ../supabase/migrations/20261013110841_operational_finance.sql
\ir ../supabase/migrations/20261013143434_operational_receivable_forecast_date.sql
\ir ../supabase/migrations/20261014002017_operational_receipt_deadline.sql
\ir ../supabase/migrations/20261019120000_operational_cash_adjustment.sql
\ir ../supabase/migrations/20261104220000_op_finance_bridge_inbox_outbox.sql
\ir ../supabase/migrations/20261108210000_op_finance_bridge_receivables.sql
do $$
declare w uuid;actor uuid:=gen_random_uuid();e1 uuid;e2 uuid;r jsonb;led uuid;today date:=(now() at time zone 'America/Bahia')::date;ev jsonb;
begin
 insert into public.workspaces default values returning id into w;
 insert into public.workspace_members values(w,actor,'owner','active');
 insert into public.events(workspace_id,client_name,event_date,status,agreed_amount) values(w,'Cliente Sintetica Um',today+20,'confirmado',2000) returning id into e1;
 insert into public.events(workspace_id,client_name,event_date,status,agreed_amount) values(w,'Cliente Cancelada',today+30,'cancelado',900) returning id into e2;
 insert into public.contracts(event_id,signed_at,signed_html) values(e1,now(),'<p>x</p>');
 insert into public.op_finance_settings values(w,today-30,0,actor,now());
 insert into public.payments(event_id,amount,status,due_date,workspace_id) values(e1,1000,'pending',today+5,w),(e1,1000,'confirmado',today-2,w);
 r:=public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','movement','kind','receipt','event_id',e1,'amount_cents',100000,'occurred_on',today-2,'destination','Conta externa'));
 led:=(r->>'id')::uuid;
 r:=public.op_finance_bridge_receivables(w);
 if jsonb_array_length(r)<>1 then raise exception 'evento cancelado não pode entrar: %',r;end if;
 ev:=r->0;
 if (ev->>'contract_cents')::bigint<>200000 or not (ev->>'signed')::boolean or jsonb_array_length(ev->'parcels')<>1 or (ev->'parcels'->0->>'amount_cents')::bigint<>100000
  or (ev->'receipts'->0->>'destination')<>'Conta externa' or (ev->'receipts'->0->>'reversed')::boolean then raise exception 'recebíveis: %',ev;end if;
 if ev ? 'cpf' or ev::text like '%<p>%' then raise exception 'vazou dado do contrato';end if;
 perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','reverse','entry_id',led,'notes','teste'));
 if not (public.op_finance_bridge_receivables(w)->0->'receipts'->0->>'reversed')::boolean then raise exception 'estorno não aparece';end if;
 if exists(select 1 from information_schema.routine_privileges where routine_name='op_finance_bridge_receivables' and grantee in('anon','authenticated','PUBLIC')) then raise exception 'grant público';end if;
 raise notice 'OK: recebíveis da ponte';
end $$;
rollback;
