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
\ir ../supabase/migrations/20261107130000_op_finance_payment_sync.sql
do $$
declare w uuid;actor uuid:=gen_random_uuid();e uuid;p uuid;p2 uuid;led uuid;r jsonb;c_before text;today date:=(now() at time zone 'America/Bahia')::date;
begin
 insert into public.workspaces default values returning id into w;
 insert into public.workspace_members values(w,actor,'owner','active');
 insert into public.events(workspace_id,client_name,event_date,status,agreed_amount) values(w,'Cliente Sintetica',today+30,'confirmado',3000) returning id into e;
 insert into public.contracts(event_id,signed_at,signed_html) values(e,now(),'<p>x</p>');
 select md5(string_agg(to_jsonb(c)::text,'')) into c_before from public.contracts c;
 insert into public.op_finance_settings values(w,today-30,0,actor,now());
 -- Inerte sem configuração.
 insert into public.payments(event_id,amount,status,payment_date,workspace_id) values(e,10,'confirmado',today,w);
 if exists(select 1 from public.op_finance_ledger) then raise exception 'ativo sem configuração';end if;
 insert into public.op_finance_payment_sync_settings(workspace_id,actor_id,enabled,sync_from) values(w,actor,true,today-1);
 -- Confirmar a parcela: um recebimento, uma entrada na outbox da ponte.
 insert into public.payments(event_id,amount,status,due_date,workspace_id) select e,800,'pending',today,w returning id into p;
 update public.payments set status='confirmado',payment_date=today,payment_method='pix' where id=p;
 led:=(select ledger_id from public.op_finance_payment_receipts where payment_id=p and state='active');
 if led is null or (select amount_cents from public.op_finance_ledger where id=led)<>80000 or (select origin from public.op_finance_ledger where id=led)<>'harmonics_payment' then raise exception 'confirmação não gerou caixa';end if;
 if (select count(*) from public.op_finance_bridge_outbox where ledger_id=led and kind='receipt')<>1 then raise exception 'não seguiu para a ponte';end if;
 -- Idempotência: salvar de novo não duplica.
 update public.payments set notes='obs' where id=p; update public.payments set status='Confirmado' where id=p;
 if (select count(*) from public.op_finance_ledger where kind='receipt' and amount_cents=80000)<>1 then raise exception 'duplicou';end if;
 -- Estorno por alteração de valor, desconfirmação e exclusão; histórico preservado.
 update public.payments set amount=850 where id=p;
 if (select count(*) from public.op_finance_ledger where reverses_id=led)<>1 or not exists(select 1 from public.op_finance_ledger where id=led) then raise exception 'troca de valor';end if;
 if (select count(*) from public.op_finance_bridge_outbox where kind='reversal' and reverses_id=led)<>1 then raise exception 'estorno não seguiu para a ponte';end if;
 led:=(select ledger_id from public.op_finance_payment_receipts where payment_id=p);
 update public.payments set status='pending' where id=p;
 if (select state from public.op_finance_payment_receipts where payment_id=p)<>'reversed' or (select count(*) from public.op_finance_ledger where reverses_id=led)<>1 then raise exception 'desconfirmar';end if;
 update public.payments set status='confirmado' where id=p;
 led:=(select ledger_id from public.op_finance_payment_receipts where payment_id=p);
 delete from public.payments where id=p;
 if (select count(*) from public.op_finance_ledger where reverses_id=led)<>1 then raise exception 'exclusão';end if;
 -- Recebimento vindo do Foco pela ponte é adotado, não duplicado, e não é estornado ao desconfirmar.
 r:=public.op_finance_bridge_receive(w,actor,gen_random_uuid(),e,50000,today,7,null);
 insert into public.payments(event_id,amount,status,payment_date,workspace_id) values(e,500,'confirmado',today,w) returning id into p2;
 if (select ledger_id from public.op_finance_payment_receipts where payment_id=p2)<>(r->>'ledger_id')::uuid or (select count(*) from public.op_finance_ledger where kind='receipt' and amount_cents=50000)<>1 then raise exception 'adoção do recebimento da ponte';end if;
 update public.payments set status='pending' where id=p2;
 if exists(select 1 from public.op_finance_ledger where reverses_id=(r->>'ledger_id')::uuid) then raise exception 'estornou recebimento adotado';end if;
 -- Dois candidatos iguais: revisão, nada criado.
 perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','movement','kind','receipt','event_id',e,'amount_cents',4400,'occurred_on',today));
 perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','movement','kind','receipt','event_id',e,'amount_cents',4400,'occurred_on',today));
 insert into public.payments(event_id,amount,status,payment_date,workspace_id) values(e,44,'confirmado',today,w) returning id into p2;
 if (select state||':'||reason from public.op_finance_payment_receipts where payment_id=p2)<>'needs_review:ambiguous_existing_receipt' or (select count(*) from public.op_finance_ledger where amount_cents=4400)<>2 then raise exception 'ambiguidade';end if;
 -- Fora da janela e data futura não geram; falha (sem marco zero) não bloqueia salvar.
 insert into public.payments(event_id,amount,status,payment_date,workspace_id) values(e,9,'confirmado',today-10,w),(e,8,'confirmado',today+5,w);
 if exists(select 1 from public.op_finance_ledger where amount_cents in(900,800)) then raise exception 'fora da janela';end if;
 delete from public.op_finance_settings where workspace_id=w;
 insert into public.payments(event_id,amount,status,payment_date,workspace_id) values(e,66,'confirmado',today,w) returning id into p2;
 if (select state from public.op_finance_payment_receipts where payment_id=p2)<>'needs_review' then raise exception 'falha não registrada';end if;
 if (select md5(string_agg(to_jsonb(c)::text,'')) from public.contracts c)<>c_before then raise exception 'contrato alterado';end if;
 if exists(select 1 from information_schema.role_table_grants where table_name like 'op_finance_payment%' and grantee in('anon','authenticated','PUBLIC')) then raise exception 'grant público';end if;
 raise notice 'OK: sincronização de pagamentos com o caixa operacional';
end $$;
rollback;
