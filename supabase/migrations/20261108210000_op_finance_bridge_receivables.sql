-- Recebíveis por evento para o livro central (Foco), somente leitura e só pela ponte assinada.
-- Fonte: contrato conferido (ou valor contratado), recebimentos do caixa operacional (com origem,
-- destino e estorno) e parcelas pendentes. Sem CPF, endereço ou documento assinado.
create or replace function public.op_finance_bridge_receivables(p_workspace uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(x order by x->>'event_date'),'[]'::jsonb) from (
  select jsonb_build_object(
   'event_id',e.id,'client_name',e.client_name,'event_date',e.event_date,'event_status',e.status,
   -- Evento anterior à abertura do caixa operacional: recebimentos ficaram no legado, não aqui.
   'before_opening',coalesce(e.event_date<(select o.opening_on from public.op_finance_settings o where o.workspace_id=p_workspace),false),
   'signed',exists(select 1 from public.contracts c where c.event_id=e.id and c.signed_at is not null),
   'contract_cents',coalesce((select s.contract_cents from public.op_finance_events s where s.event_id=e.id and s.status='checked'),round(coalesce(e.agreed_amount,0)*100)::bigint),
   'expected_receipt_on',(select s.expected_receipt_on from public.op_finance_events s where s.event_id=e.id),
   'receipts',coalesce((select jsonb_agg(jsonb_build_object('ledger_id',l.id,'amount_cents',l.amount_cents,'occurred_on',l.occurred_on,'in_opening',l.in_opening,'origin',l.origin,'destination',nullif(btrim(coalesce(l.destination,'')),''),'reversed',exists(select 1 from public.op_finance_ledger r where r.reverses_id=l.id)) order by l.occurred_on) from public.op_finance_ledger l where l.event_id=e.id and l.workspace_id=p_workspace and l.kind='receipt'),'[]'::jsonb),
   'parcels',coalesce((select jsonb_agg(jsonb_build_object('payment_id',p.id,'amount_cents',round(p.amount*100)::bigint,'due_date',p.due_date,'status',p.status) order by p.due_date nulls last) from public.payments p where p.event_id=e.id and lower(trim(coalesce(p.status,''))) in('pending','pendente','em_analise','em análise','aguardando_validacao','pendente_validacao')),'[]'::jsonb)) x
  from public.events e
  where e.workspace_id=p_workspace and lower(coalesce(e.status,'')) not in('cancelled','cancelado','canceled')
   and (e.event_date is null or e.event_date>=(now() at time zone 'America/Bahia')::date-180)
 ) y;
$$;
revoke all on function public.op_finance_bridge_receivables(uuid) from public,anon,authenticated;
grant execute on function public.op_finance_bridge_receivables(uuid) to service_role;
