-- Pagamento confirmado na tela de pagamentos vira recebimento no caixa operacional, uma única vez.
-- O recebimento criado aqui segue pela captura já existente (op_finance_bridge_capture) para o Foco.
-- Aditiva e inerte até existir uma linha habilitada em op_finance_payment_sync_settings.
-- Não altera contratos, valor contratado, pagamentos nem lançamentos existentes; o caixa continua
-- imutável e só recebe lançamentos novos pelo op_finance_command já existente.
create table if not exists public.op_finance_payment_sync_settings(
 workspace_id uuid primary key references public.workspaces(id),
 actor_id uuid not null,enabled boolean not null default false,sync_from date not null,
 created_at timestamptz not null default now());
create table if not exists public.op_finance_payment_receipts(
 payment_id uuid primary key,workspace_id uuid not null references public.workspaces(id),event_id uuid not null,
 ledger_id uuid unique references public.op_finance_ledger(id),amount_cents bigint,paid_on date,
 state text not null check(state in('active','reversed','needs_review')),reason text,adopted boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.op_finance_payment_sync_settings enable row level security;
alter table public.op_finance_payment_receipts enable row level security;
revoke all on public.op_finance_payment_sync_settings,public.op_finance_payment_receipts from public,anon,authenticated;
grant all on public.op_finance_payment_sync_settings,public.op_finance_payment_receipts to service_role;

-- Regras: confirmar (status pago/confirmado, data real a partir de sync_from) cria o recebimento;
-- havendo recebimento igual já lançado (mesmo evento e valor, até 3 dias, sem vínculo), ele é
-- adotado; dois candidatos ficam em revisão. Desconfirmar, mudar valor/data ou excluir estorna
-- o recebimento que este gatilho criou. Qualquer falha fica registrada e nunca impede salvar.
create or replace function public.op_finance_payment_sync() returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.op_finance_payment_sync_settings;row public.payments;m public.op_finance_payment_receipts;ok boolean;v bigint;n int;adopt uuid;r jsonb;created boolean:=false;today date:=(now() at time zone 'America/Bahia')::date;st text;
begin
 row:=case when tg_op='DELETE' then old else new end;
 select * into s from public.op_finance_payment_sync_settings where enabled and workspace_id=row.workspace_id;
 if s.workspace_id is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('op-payment-sync:'||row.event_id::text,0));
 select * into m from public.op_finance_payment_receipts where payment_id=row.id for update;
 if tg_op<>'DELETE' then st:=lower(trim(coalesce(new.status,'')));end if;
 ok:=tg_op<>'DELETE' and st in('paid','pago','confirmed','confirmado','quitado') and new.payment_date is not null and new.payment_date>=s.sync_from and new.payment_date<=today and new.amount>0;
 v:=case when tg_op='DELETE' then null else round(new.amount*100)::bigint end;
 begin
  if m.state='active' and (not ok or m.amount_cents is distinct from v or m.paid_on is distinct from new.payment_date) then
   if not m.adopted then perform public.op_finance_command(s.workspace_id,s.actor_id,md5(row.id::text||':'||m.ledger_id::text||':reverse')::uuid,jsonb_build_object('action','reverse','entry_id',m.ledger_id,'notes','Pagamento '||case when tg_op='DELETE' then 'excluído' else 'alterado' end||' na tela de pagamentos'));end if;
   update public.op_finance_payment_receipts set state='reversed',reason=case when m.adopted then 'adopted_receipt_kept' end,updated_at=now() where payment_id=row.id;
   m.state:='reversed';
  end if;
  if not ok or m.state='active' then return null;end if;
  select count(*),min(l.id::text)::uuid into n,adopt from public.op_finance_ledger l
   where l.workspace_id=s.workspace_id and l.event_id=row.event_id and l.kind='receipt' and l.amount_cents=v and abs(l.occurred_on-new.payment_date)<=3
   and not exists(select 1 from public.op_finance_ledger x where x.reverses_id=l.id)
   and not exists(select 1 from public.op_finance_payment_receipts p where p.ledger_id=l.id and p.state='active');
  if n>1 then
   insert into public.op_finance_payment_receipts(payment_id,workspace_id,event_id,amount_cents,paid_on,state,reason) values(row.id,s.workspace_id,row.event_id,v,new.payment_date,'needs_review','ambiguous_existing_receipt')
    on conflict(payment_id) do update set ledger_id=null,amount_cents=excluded.amount_cents,paid_on=excluded.paid_on,state='needs_review',reason=excluded.reason,updated_at=now();
   return null;
  end if;
  if adopt is null then
   r:=public.op_finance_command(s.workspace_id,s.actor_id,md5('payment:'||row.id::text||':'||v::text||':'||new.payment_date::text)::uuid,jsonb_build_object('action','movement','kind','receipt','event_id',row.event_id,'amount_cents',v,'occurred_on',new.payment_date,'method',new.payment_method,'origin','harmonics_payment','notes','Pagamento confirmado na tela de pagamentos'));
   adopt:=(r->>'id')::uuid;created:=true;
  end if;
  insert into public.op_finance_payment_receipts(payment_id,workspace_id,event_id,ledger_id,amount_cents,paid_on,state,adopted) values(row.id,s.workspace_id,row.event_id,adopt,v,new.payment_date,'active',not created)
   on conflict(payment_id) do update set ledger_id=excluded.ledger_id,amount_cents=excluded.amount_cents,paid_on=excluded.paid_on,state='active',reason=null,adopted=excluded.adopted,updated_at=now();
 exception when others then
  insert into public.op_finance_payment_receipts(payment_id,workspace_id,event_id,amount_cents,paid_on,state,reason) values(row.id,row.workspace_id,row.event_id,v,case when tg_op<>'DELETE' then new.payment_date end,'needs_review',left(sqlerrm,300))
   on conflict(payment_id) do update set state='needs_review',reason=excluded.reason,updated_at=now();
 end;
 return null;
end $$;
revoke all on function public.op_finance_payment_sync() from public,anon,authenticated;
drop trigger if exists op_finance_payment_sync on public.payments;
create trigger op_finance_payment_sync after insert or update of status,amount,payment_date or delete on public.payments
for each row execute function public.op_finance_payment_sync();
