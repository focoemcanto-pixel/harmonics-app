-- Governança das tabelas oficiais de preço (quote_price_rules) e de orçamentos (quotes)
--  - Leitura de regras: membros ativos do workspace; custos internos (musician_fee) só Owner/Admin.
--  - Escrita de regras: somente pelo servidor (service_role), via public.apply_price_rule_change (atômica e auditada).
--  - Orçamentos (quotes, com custos/lucro no snapshot): o app só acessa pelo servidor; o navegador fica sem escrita
--    e a leitura passa a ser só de Owner/Admin/Financeiro. A política de leitura de integração (arm_read_quote) é mantida.
--    Nenhuma alteração de dados existentes: só políticas, permissões, uma tabela de auditoria e funções.

-- 1) Auditoria das alterações (append-only).
create table if not exists public.quote_price_rule_changes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  actor uuid not null,
  action text not null check (action in ('new_validity')),
  category text not null,
  item_key text not null,
  reason text not null check (char_length(reason) between 3 and 500),
  closed_rule jsonb,
  next_rule jsonb,
  new_rule jsonb not null,
  state_hash_before text not null,
  created_at timestamptz not null default now()
);
create index if not exists quote_price_rule_changes_ws_idx on public.quote_price_rule_changes (workspace_id, created_at desc);
alter table public.quote_price_rule_changes enable row level security;
revoke all on public.quote_price_rule_changes from public, anon, authenticated;

-- 2) Políticas: sem escrita pelo navegador; custo interno só para Owner/Admin.
drop policy if exists quote_price_rules_workspace on public.quote_price_rules;
drop policy if exists "workspace quote price rules" on public.quote_price_rules;
drop policy if exists quote_price_rules_member_select on public.quote_price_rules;
create policy quote_price_rules_member_select on public.quote_price_rules
  for select to authenticated
  using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
       where wm.user_id = (select auth.uid()) and wm.status = 'active'
         and (quote_price_rules.category <> 'musician_fee' or lower(wm.role) in ('owner', 'admin', 'administrador'))
    )
  );
revoke insert, update, delete, truncate on public.quote_price_rules from anon, authenticated;
revoke all on public.quote_price_rules from anon;

-- 2b) Orçamentos: sem escrita pelo navegador; leitura só para quem pode ver custos.
drop policy if exists quotes_workspace on public.quotes;
drop policy if exists "workspace quotes" on public.quotes;
drop policy if exists quotes_finance_select on public.quotes;
create policy quotes_finance_select on public.quotes
  for select to authenticated
  using (
    workspace_id in (
      select wm.workspace_id from public.workspace_members wm
       where wm.user_id = (select auth.uid()) and wm.status = 'active'
         and lower(wm.role) in ('owner', 'admin', 'administrador', 'financeiro')
    )
  );
revoke insert, update, delete, truncate on public.quotes from anon, authenticated;
revoke all on public.quotes from anon;

-- 3) Estado de uma chave (para detectar alteração concorrente entre a prévia e a confirmação).
create or replace function public.price_rules_state_hash(p_workspace_id uuid, p_category text, p_item_key text)
returns text language sql stable security invoker set search_path = public as $$
  select md5(coalesce(string_agg(r.id::text || ':' || r.amount::text || ':' || r.valid_from::text || ':' || coalesce(r.valid_until::text, ''), ',' order by r.valid_from, r.id), ''))
    from public.quote_price_rules r
   where r.workspace_id = p_workspace_id and r.category = p_category and r.item_key = p_item_key;
$$;

-- 4) Nova vigência: encerra na véspera a regra vigente, respeita regra futura, nunca sobrescreve histórico.
create or replace function public.apply_price_rule_change(
  p_workspace_id uuid, p_actor uuid, p_category text, p_item_key text, p_label text,
  p_amount numeric, p_valid_from date, p_reason text, p_expected_hash text
) returns table (rule_id uuid, closed_rule_id uuid, new_valid_until date)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare v_hash text; cur public.quote_price_rules%rowtype; nxt public.quote_price_rules%rowtype; v_new uuid; v_until date;
begin
  if p_actor is null then raise exception 'actor_required' using errcode = '22023'; end if;
  if p_category not in ('ceremony','reception','sound','transport','musician_fee','other') then raise exception 'category_invalid' using errcode = '22023'; end if;
  if coalesce(trim(p_item_key), '') = '' then raise exception 'item_key_invalid' using errcode = '22023'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'amount_invalid' using errcode = '22023'; end if;
  if p_valid_from is null then raise exception 'valid_from_required' using errcode = '22023'; end if;
  if char_length(coalesce(trim(p_reason), '')) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  -- Serializa alterações da mesma chave.
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || '|' || p_category || '|' || p_item_key, 0));
  perform 1 from public.quote_price_rules r where r.workspace_id = p_workspace_id and r.category = p_category and r.item_key = p_item_key for update;
  v_hash := public.price_rules_state_hash(p_workspace_id, p_category, p_item_key);
  if p_expected_hash is distinct from v_hash then raise exception 'state_changed' using errcode = '40001'; end if;
  if exists (select 1 from public.quote_price_rules r where r.workspace_id = p_workspace_id and r.category = p_category and r.item_key = p_item_key and r.valid_from = p_valid_from) then
    raise exception 'rule_exists_same_start' using errcode = '23505';
  end if;
  select * into cur from public.quote_price_rules r
   where r.workspace_id = p_workspace_id and r.category = p_category and r.item_key = p_item_key
     and r.valid_from < p_valid_from and (r.valid_until is null or r.valid_until >= p_valid_from)
   order by r.valid_from desc limit 1;
  select * into nxt from public.quote_price_rules r
   where r.workspace_id = p_workspace_id and r.category = p_category and r.item_key = p_item_key and r.valid_from > p_valid_from
   order by r.valid_from asc limit 1;
  v_until := case when nxt.id is not null then nxt.valid_from - 1 else null end;
  if cur.id is not null then
    update public.quote_price_rules set valid_until = p_valid_from - 1, updated_at = now() where id = cur.id;
  end if;
  insert into public.quote_price_rules (workspace_id, category, item_key, label, amount, valid_from, valid_until, metadata)
  values (p_workspace_id, p_category, p_item_key, coalesce(nullif(trim(p_label), ''), p_item_key), p_amount, p_valid_from, v_until,
          jsonb_build_object('source', 'central', 'changed_by', p_actor))
  returning id into v_new;
  insert into public.quote_price_rule_changes (workspace_id, actor, action, category, item_key, reason, closed_rule, next_rule, new_rule, state_hash_before)
  values (p_workspace_id, p_actor, 'new_validity', p_category, p_item_key, trim(p_reason),
          case when cur.id is null then null else to_jsonb(cur) end,
          case when nxt.id is null then null else to_jsonb(nxt) end,
          (select to_jsonb(r) from public.quote_price_rules r where r.id = v_new), v_hash);
  return query select v_new, cur.id, v_until;
end $$;

revoke all on function public.apply_price_rule_change(uuid, uuid, text, text, text, numeric, date, text, text) from public, anon, authenticated;
revoke all on function public.price_rules_state_hash(uuid, text, text) from public, anon, authenticated;
