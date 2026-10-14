create or replace function public.op_finance_command(w uuid, actor uuid, request_id uuid, command jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 a text:=command->>'action'; e uuid:=nullif(command->>'event_id','')::uuid;
 old jsonb; result jsonb; s public.op_finance_settings; sheet public.op_finance_events;
 original public.op_finance_ledger; c jsonb; paid bigint; amount bigint; d date; cost uuid;
 seen uuid[]:='{}'; deadline date; forecast date;
begin
 perform pg_advisory_xact_lock(hashtextextended(w::text,0));
 select after_value into result from public.op_finance_audit q where q.request_id=op_finance_command.request_id and workspace_id=w;
 if found then return result; end if;
 if not exists(select 1 from public.workspace_members where workspace_id=w and user_id=actor and status='active' and role in ('owner','admin','administrador','financeiro')) then raise exception 'Sem permissão financeira neste workspace.'; end if;
 if e is not null and not exists(select 1 from public.events where id=e and workspace_id=w) then raise exception 'Evento fora do workspace.'; end if;
 select * into s from public.op_finance_settings where workspace_id=w;
 if a='opening' then
   if s.workspace_id is not null then raise exception 'Marco zero já definido. Não pode ser sobrescrito.'; end if;
   insert into public.op_finance_settings values(w,(command->>'opening_on')::date,(command->>'opening_cents')::bigint,actor,now()) returning to_jsonb(op_finance_settings.*) into result;
 elsif a='default' then
   select to_jsonb(t) into old from public.op_finance_defaults t where workspace_id=w and key=command->>'key';
   insert into public.op_finance_defaults values(w,command->>'key',(command->>'amount_cents')::bigint)
   on conflict(workspace_id,key) do update set amount_cents=excluded.amount_cents returning to_jsonb(op_finance_defaults.*) into result;
 elsif a='event' then
   select * into sheet from public.op_finance_events where event_id=e;
   old:=to_jsonb(sheet);
   if coalesce(sheet.revision,0)<>coalesce((command->>'revision')::int,0) then raise exception 'Evento alterado em outra janela. Atualize antes de salvar.'; end if;
   if jsonb_typeof(command->'costs') is distinct from 'array' then raise exception 'Custos inválidos.'; end if;
   for c in select value from jsonb_array_elements(command->'costs') loop
     cost:=(c->>'id')::uuid;
     if cost=any(seen) then raise exception 'Custo duplicado.'; end if;
     seen:=array_append(seen,cost);
     if (c->>'amount_cents')::bigint<0 or c->>'description' is null or c->>'status' not in ('predicted','confirmed') then raise exception 'Custo inválido.'; end if;
     select coalesce(sum(l.amount_cents),0) into paid from public.op_finance_ledger l where l.workspace_id=w and l.event_id=e and l.cost_id=cost and l.kind='payment' and not exists(select 1 from public.op_finance_ledger r where r.reverses_id=l.id);
     if paid>(c->>'amount_cents')::bigint then raise exception 'Custo inferior ao valor já pago. Estorne o pagamento antes.'; end if;
   end loop;
   if exists(select 1 from public.op_finance_ledger l where l.workspace_id=w and l.event_id=e and kind='payment' and not (l.cost_id=any(seen)) and not exists(select 1 from public.op_finance_ledger r where r.reverses_id=l.id)) then raise exception 'Não remova custos com pagamento ativo.'; end if;
   select event_date::date - 2 into deadline from public.events where id=e and workspace_id=w;
   forecast:=case when command ? 'expected_receipt_on' then nullif(command->>'expected_receipt_on','')::date else sheet.expected_receipt_on end;
   if forecast is not null and deadline is not null and forecast>deadline then raise exception 'Previsão deve ser até dois dias antes do evento.'; end if;
   forecast:=coalesce(forecast,deadline);
   insert into public.op_finance_events(workspace_id,event_id,contract_cents,status,costs,revision,updated_by,updated_at,expected_receipt_on) values(w,e,(command->>'contract_cents')::bigint,command->>'status',command->'costs',1,actor,now(),forecast)
   on conflict(event_id) do update set contract_cents=excluded.contract_cents,status=excluded.status,costs=excluded.costs,revision=op_finance_events.revision+1,updated_by=actor,updated_at=now(),expected_receipt_on=excluded.expected_receipt_on returning to_jsonb(op_finance_events.*) into result;
 elsif a='movement' then
   if s.workspace_id is null then raise exception 'Defina o marco zero primeiro.'; end if;
   amount:=(command->>'amount_cents')::bigint; d:=(command->>'occurred_on')::date;
   if d>(now() at time zone 'America/Bahia')::date then raise exception 'Movimento realizado não pode ter data futura.'; end if;
   if command->>'kind'='payment' then
     cost:=(command->>'cost_id')::uuid;
     select * into sheet from public.op_finance_events where event_id=e and workspace_id=w;
     select value into c from jsonb_array_elements(sheet.costs) where value->>'id'=cost::text;
     if c is null then raise exception 'Custo não salvo no evento.'; end if;
     select coalesce(sum(l.amount_cents),0) into paid from public.op_finance_ledger l where workspace_id=w and event_id=e and cost_id=cost and kind='payment' and not exists(select 1 from public.op_finance_ledger r where r.reverses_id=l.id);
     if paid+amount>(c->>'amount_cents')::bigint then raise exception 'Pagamento excede o custo acordado.'; end if;
   end if;
   insert into public.op_finance_ledger(workspace_id,event_id,cost_id,kind,amount_cents,occurred_on,in_opening,method,origin,destination,notes,proof_reference,created_by)
   values(w,e,cost,command->>'kind',amount,d,d<s.opening_on or coalesce((command->>'in_opening')::boolean,false),command->>'method',command->>'origin',command->>'destination',command->>'notes',command->>'proof_reference',actor) returning to_jsonb(op_finance_ledger.*) into result;
 elsif a='reverse' then
   select * into original from public.op_finance_ledger where id=(command->>'entry_id')::uuid and workspace_id=w and kind<>'reversal';
   if original.id is null or nullif(trim(command->>'notes'),'') is null then raise exception 'Lançamento ou motivo de estorno inválido.'; end if;
   insert into public.op_finance_ledger(workspace_id,event_id,cost_id,kind,amount_cents,occurred_on,in_opening,reverses_id,notes,created_by)
   values(w,original.event_id,original.cost_id,'reversal',original.amount_cents,(now() at time zone 'America/Bahia')::date,original.in_opening,original.id,command->>'notes',actor) returning to_jsonb(op_finance_ledger.*) into result;
 else raise exception 'Comando inválido.';
 end if;
 insert into public.op_finance_audit values(request_id,w,actor,a,old,result,now());
 return result;
end $$;
revoke execute on function public.op_finance_command(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.op_finance_command(uuid,uuid,uuid,jsonb) to service_role;
