-- DANGEROUS: manual rollback only. Requires an approved maintenance window.
-- Refuse any automatic removal once the bridge has observed a financial movement.
begin;
do $$
begin
 if exists(select 1 from public.op_finance_bridge_receipts limit 1)
  or exists(select 1 from public.op_finance_bridge_outbox limit 1) then
   raise exception 'Bridge has live references. Preserve state; disable endpoint and plan compensating migration.';
 end if;
end $$;
drop trigger if exists op_finance_bridge_capture_insert on public.op_finance_ledger;
drop function if exists public.op_finance_bridge_capture();
drop function if exists public.op_finance_bridge_receive(uuid,uuid,uuid,uuid,bigint,date,bigint,boolean);
drop table if exists public.op_finance_bridge_receipts;
drop table if exists public.op_finance_bridge_outbox;
commit;
