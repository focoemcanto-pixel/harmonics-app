-- Run in a single transaction against the audited database; all fixtures rolled back.
begin;
do $$
declare w uuid; actor uuid; e uuid; cost uuid:=gen_random_uuid(); r jsonb; receipt jsonb;
 req uuid:=gen_random_uuid(); bad boolean; costs jsonb; n bigint; before_hash text;
begin
 select m.workspace_id,m.user_id into w,actor from public.workspace_members m where m.status='active' and m.role in ('owner','admin','financeiro') and exists(select 1 from public.events where workspace_id=m.workspace_id and event_date>=current_date) limit 1;
 select id into e from public.events where workspace_id=w and event_date>=current_date limit 1;
 select md5(jsonb_agg(to_jsonb(t) order by id)::text) into before_hash from public.events t;
 if e is null then raise exception 'Fixture event missing'; end if;
 r:=public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','opening','opening_on',current_date,'opening_cents',1000000));
 bad:=false;begin perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','opening','opening_on',current_date,'opening_cents',0));exception when others then bad:=true;end;if not bad then raise exception 'Opening overwritten';end if;
 costs:=jsonb_build_array(jsonb_build_object('id',cost,'musician_id',gen_random_uuid(),'description','Teste isolado','category','musician','amount_cents',50000,'status','confirmed'));
 r:=public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','event','event_id',e,'contract_cents',470000,'revision',0,'status','checked','costs',costs));
 r:=public.op_finance_command(w,actor,req,jsonb_build_object('action','movement','event_id',e,'kind','receipt','amount_cents',100000,'occurred_on',current_date));
 receipt:=public.op_finance_command(w,actor,req,jsonb_build_object('action','movement','event_id',e,'kind','receipt','amount_cents',100000,'occurred_on',current_date));
 if r->>'id'<>receipt->>'id' then raise exception 'Idempotency broken';end if;
 select count(*) into n from public.op_finance_ledger where workspace_id=w and kind='receipt'; if n<>1 then raise exception 'Duplicate receipt';end if;
 r:=public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','movement','event_id',e,'kind','receipt','amount_cents',150000,'occurred_on',current_date-1));
 if not (r->>'in_opening')::boolean then raise exception 'Historic receipt counted as cash';end if;
 bad:=false;begin perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','event','event_id',e,'contract_cents',470000,'revision',0,'status','checked','costs',costs));exception when others then bad:=true;end;if not bad then raise exception 'Stale revision accepted';end if;
 r:=public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','movement','event_id',e,'cost_id',cost,'kind','payment','amount_cents',20000,'occurred_on',current_date));
 bad:=false;begin perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','movement','event_id',e,'cost_id',cost,'kind','payment','amount_cents',40000,'occurred_on',current_date));exception when others then bad:=true;end;if not bad then raise exception 'Overpayment accepted';end if;
 bad:=false;begin perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','event','event_id',e,'contract_cents',470000,'revision',1,'status','checked','costs','[]'::jsonb));exception when others then bad:=true;end;if not bad then raise exception 'Paid cost deleted';end if;
 perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','movement','event_id',e,'cost_id',cost,'kind','payment','amount_cents',30000,'occurred_on',current_date));
 perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','reverse','entry_id',r->>'id','notes','Teste de estorno'));
 bad:=false;begin perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','reverse','entry_id',r->>'id','notes','Duplicado'));exception when others then bad:=true;end;if not bad then raise exception 'Double reversal accepted';end if;
 perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','default','key','role:Teste','amount_cents',40000));
 perform public.op_finance_command(w,actor,gen_random_uuid(),jsonb_build_object('action','movement','kind','withdrawal','destination','pessoal','amount_cents',150000,'occurred_on',current_date));
 bad:=false;begin update public.op_finance_ledger set notes='destructive' where id=(receipt->>'id')::uuid;exception when others then bad:=true;end;if not bad then raise exception 'Immutable history modified';end if;
 bad:=false;begin perform public.op_finance_command(w,gen_random_uuid(),gen_random_uuid(),jsonb_build_object('action','default','key','bad','amount_cents',1));exception when others then bad:=true;end;if not bad then raise exception 'Unauthorized access accepted';end if;
 if before_hash<>(select md5(jsonb_agg(to_jsonb(t) order by id)::text) from public.events t) then raise exception 'Legacy changed';end if;
 if has_table_privilege('anon','public.op_finance_ledger','select') or has_table_privilege('authenticated','public.op_finance_ledger','insert') then raise exception 'Client data exposure';end if;
end $$;
rollback;
