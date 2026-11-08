-- Harmonics AI V3: inteligência comercial. Aditivo e INERTE (tudo desligado por padrão).
-- Conhecimento versionado com aprovação, aprendizado supervisionado, territórios, catálogo de
-- músicos, CRM na conversa, follow-ups, fechamento com pré-contrato idempotente.
-- Acesso somente via backend (service_role); anon/authenticated sem privilégios.

-- ---------------------------------------------------------------------------
-- Configuração comercial (tudo desligado)
-- ---------------------------------------------------------------------------
alter table public.ai_workspace_settings
  add column if not exists autonomous_closing_enabled boolean not null default false,
  add column if not exists followup_enabled boolean not null default false,
  add column if not exists followup_days integer[] not null default '{2,5,10}',
  add column if not exists followup_templates text[] not null default '{}',
  add column if not exists followup_template_language text not null default 'pt_BR',
  add column if not exists notify_admin_on_handoff boolean not null default false,
  add column if not exists handoff_contact_name text,
  add column if not exists strategies_enabled text[] not null default '{discovery,empathy,price_objection,closing}',
  add column if not exists logistics_rules jsonb not null default '{}'::jsonb,
  add column if not exists min_margin_pct numeric(5,2),
  add column if not exists schedule_buffer_minutes integer not null default 90;

-- ---------------------------------------------------------------------------
-- CRM na própria conversa (não duplica Inbox/Orçamentos)
-- ---------------------------------------------------------------------------
alter table public.ai_conversations
  add column if not exists sales_stage text not null default 'new',
  add column if not exists objections text[] not null default '{}',
  add column if not exists lost_reason text,
  add column if not exists deal_value numeric(12,2),
  add column if not exists quote_id uuid,
  add column if not exists precontract_id uuid,
  add column if not exists opted_out boolean not null default false,
  add column if not exists opted_out_at timestamptz,
  add column if not exists handoff_summary text,
  add column if not exists stage_updated_at timestamptz;
alter table public.ai_conversations drop constraint if exists ai_conversations_sales_stage_check;
alter table public.ai_conversations add constraint ai_conversations_sales_stage_check
  check (sales_stage in ('new','qualifying','proposal','negotiation','closing','contract_sent','won','lost','post_sale'));
create index if not exists ai_conversations_ws_stage_idx on public.ai_conversations(workspace_id, sales_stage);

create table if not exists public.ai_stage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null,
  from_stage text, to_stage text not null, reason text,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, workspace_id) references public.ai_conversations(id, workspace_id) on delete cascade
);
create index if not exists ai_stage_events_ws_created_idx on public.ai_stage_events(workspace_id, created_at);

-- Aprovações: novos tipos.
alter table public.ai_approvals drop constraint if exists ai_approvals_kind_check;
alter table public.ai_approvals add constraint ai_approvals_kind_check
  check (kind in ('proposal','discount','contract_change','other','availability_review','pricing_exception','territory_exception','closing'));

-- Outbox: templates Meta (follow-up fora da janela de 24h).
alter table public.ai_message_outbox
  add column if not exists message_kind text not null default 'text' check (message_kind in ('text','template')),
  add column if not exists template_name text,
  add column if not exists template_language text,
  add column if not exists template_params jsonb;

-- ---------------------------------------------------------------------------
-- Conhecimento versionado (regras, FAQ, políticas, rider, exemplos, respostas por intenção)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  item_key text not null,
  version integer not null default 1,
  kind text not null check (kind in ('rule','faq','policy','rider','example','style','response','post_sale')),
  title text not null,
  content text not null,
  intents text[] not null default '{}',
  keywords text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  priority integer not null default 50 check (priority between 0 and 100),
  status text not null default 'pending_approval'
    check (status in ('pending_approval','active','archived','rejected')),
  source text not null default 'manual' check (source in ('manual','learned','import')),
  created_by uuid, approved_by uuid, approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, item_key, version)
);
create unique index if not exists ai_knowledge_one_active_idx
  on public.ai_knowledge_items(workspace_id, item_key) where status = 'active';
create index if not exists ai_knowledge_ws_status_idx on public.ai_knowledge_items(workspace_id, status, kind);

-- Aprendizado supervisionado: nada vira conhecimento sem aprovação.
create table if not exists public.ai_learning_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid,
  kind text not null check (kind in ('correction','human_reply','faq_pattern')),
  pattern_key text not null,
  customer_text text, ai_text text, human_text text,
  occurrences integer not null default 1,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  knowledge_item_id uuid,
  decided_by uuid, decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ai_learning_pending_pattern_idx
  on public.ai_learning_suggestions(workspace_id, kind, pattern_key) where status = 'pending';

-- Auditoria da memória do cliente (operações estilo mem0: ADD/UPDATE/DELETE).
create table if not exists public.ai_memory_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null,
  op text not null check (op in ('ADD','UPDATE','DELETE')),
  key text not null, old_value text, new_value text,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, workspace_id) references public.ai_conversations(id, workspace_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Territórios e catálogo de músicos
-- ---------------------------------------------------------------------------
create table if not exists public.ai_service_areas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  match_terms text[] not null default '{}',
  status text not null default 'served' check (status in ('served','conditional','blocked')),
  distance_km numeric(8,1),
  travel_minutes integer,
  travel_fee numeric(10,2),
  toll_fee numeric(10,2),
  lodging_required boolean not null default false,
  lodging_fee numeric(10,2),
  extra_setup_minutes integer,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.ai_musician_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null,
  display_name text not null,
  instruments text[] not null default '{}',
  roles text[] not null default '{}',
  is_primary_vocal boolean not null default false,
  fee numeric(10,2),
  video_urls text[] not null default '{}',
  portfolio_url text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, contact_id)
);
create unique index if not exists ai_musician_one_primary_vocal_idx
  on public.ai_musician_profiles(workspace_id) where is_primary_vocal and active;

-- ---------------------------------------------------------------------------
-- Remarketing e fechamento
-- ---------------------------------------------------------------------------
create table if not exists public.ai_followups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null,
  step integer not null,
  due_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','sent','cancelled','failed')),
  template_name text,
  cancel_reason text,
  outbox_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, conversation_id, step),
  foreign key (conversation_id, workspace_id) references public.ai_conversations(id, workspace_id) on delete cascade
);
create index if not exists ai_followups_due_idx on public.ai_followups(due_at) where status = 'scheduled';

create table if not exists public.ai_closings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null,
  status text not null default 'awaiting_confirmation'
    check (status in ('awaiting_confirmation','confirmed','precontract_created','link_sent','invalidated','needs_human','failed')),
  summary jsonb not null,
  summary_text text not null,
  summary_hash text not null,
  owner_version bigint not null,
  confirmation_message_id text,
  precontract_id uuid,
  quote_id uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (conversation_id, workspace_id) references public.ai_conversations(id, workspace_id) on delete cascade
);
-- No máximo um fechamento em andamento por conversa.
create unique index if not exists ai_closings_one_open_idx
  on public.ai_closings(workspace_id, conversation_id)
  where status in ('awaiting_confirmation','confirmed','precontract_created');

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------
alter table public.ai_stage_events enable row level security;
alter table public.ai_knowledge_items enable row level security;
alter table public.ai_learning_suggestions enable row level security;
alter table public.ai_memory_events enable row level security;
alter table public.ai_service_areas enable row level security;
alter table public.ai_musician_profiles enable row level security;
alter table public.ai_followups enable row level security;
alter table public.ai_closings enable row level security;
revoke all on public.ai_stage_events, public.ai_knowledge_items, public.ai_learning_suggestions,
  public.ai_memory_events, public.ai_service_areas, public.ai_musician_profiles,
  public.ai_followups, public.ai_closings from anon, authenticated;
grant select, insert, update, delete on public.ai_stage_events, public.ai_knowledge_items,
  public.ai_learning_suggestions, public.ai_memory_events, public.ai_service_areas,
  public.ai_musician_profiles, public.ai_followups, public.ai_closings to service_role;

-- ---------------------------------------------------------------------------
-- RPCs transacionais
-- ---------------------------------------------------------------------------

-- Nova versão de conhecimento. Regras/políticas/rider/FAQ nascem pendentes de aprovação.
create or replace function public.ai_knowledge_propose(
  p_workspace_id uuid, p_item_key text, p_kind text, p_title text, p_content text,
  p_intents text[], p_keywords text[], p_metadata jsonb, p_priority integer,
  p_source text, p_actor uuid
) returns table (id uuid, version integer)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare v integer; new_id uuid;
begin
  select coalesce(max(k.version), 0) + 1 into v from public.ai_knowledge_items k
   where k.workspace_id = p_workspace_id and k.item_key = p_item_key;
  insert into public.ai_knowledge_items (workspace_id, item_key, version, kind, title, content, intents,
    keywords, metadata, priority, status, source, created_by)
  values (p_workspace_id, p_item_key, v, p_kind, p_title, p_content, coalesce(p_intents, '{}'),
    coalesce(p_keywords, '{}'), coalesce(p_metadata, '{}'::jsonb), coalesce(p_priority, 50),
    'pending_approval', coalesce(p_source, 'manual'), p_actor)
  returning ai_knowledge_items.id into new_id;
  return query select new_id, v;
end $$;

-- Aprovar versão: arquiva a ativa anterior e ativa a nova (atômico). Também serve de rollback.
create or replace function public.ai_knowledge_activate(
  p_workspace_id uuid, p_id uuid, p_actor uuid
) returns table (id uuid, item_key text, version integer)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare k public.ai_knowledge_items%rowtype;
begin
  select * into k from public.ai_knowledge_items
   where ai_knowledge_items.id = p_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'knowledge not found' using errcode = 'P0002'; end if;
  if k.status = 'rejected' then raise exception 'rejected version' using errcode = '22023'; end if;
  perform 1 from public.ai_knowledge_items
   where workspace_id = p_workspace_id and item_key = k.item_key for update;
  update public.ai_knowledge_items set status = 'archived'
   where workspace_id = p_workspace_id and item_key = k.item_key and status = 'active' and ai_knowledge_items.id <> k.id;
  update public.ai_knowledge_items set status = 'active', approved_by = p_actor, approved_at = now()
   where ai_knowledge_items.id = k.id;
  return query select k.id, k.item_key, k.version;
end $$;

-- Etapa comercial com histórico (CRM).
create or replace function public.ai_set_sales_stage(
  p_workspace_id uuid, p_conversation_id uuid, p_stage text, p_reason text default null
) returns text language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare old text;
begin
  select sales_stage into old from public.ai_conversations
   where id = p_conversation_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'conversation not found in workspace' using errcode = 'P0002'; end if;
  if old = p_stage then return old; end if;
  update public.ai_conversations set sales_stage = p_stage, stage_updated_at = now(),
         lost_reason = case when p_stage = 'lost' then coalesce(p_reason, lost_reason) else lost_reason end,
         updated_at = now()
   where id = p_conversation_id;
  insert into public.ai_stage_events (workspace_id, conversation_id, from_stage, to_stage, reason)
  values (p_workspace_id, p_conversation_id, old, p_stage, p_reason);
  if p_stage in ('won','lost','contract_sent') then
    update public.ai_followups set status = 'cancelled', cancel_reason = 'stage_' || p_stage, updated_at = now()
     where workspace_id = p_workspace_id and conversation_id = p_conversation_id and status = 'scheduled';
  end if;
  return p_stage;
end $$;

-- Cancela follow-ups quando o cliente responde, humano intervém ou há opt-out.
create or replace function public.ai_cancel_followups(
  p_workspace_id uuid, p_conversation_id uuid, p_reason text
) returns integer language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare n integer;
begin
  update public.ai_followups set status = 'cancelled', cancel_reason = p_reason, updated_at = now()
   where workspace_id = p_workspace_id and conversation_id = p_conversation_id and status = 'scheduled';
  get diagnostics n = row_count;
  return n;
end $$;

-- Agenda a sequência de follow-ups (idempotente por passo).
create or replace function public.ai_schedule_followups(
  p_workspace_id uuid, p_conversation_id uuid, p_days integer[], p_templates text[]
) returns integer language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare i integer; n integer := 0; c public.ai_conversations%rowtype;
begin
  select * into c from public.ai_conversations
   where id = p_conversation_id and workspace_id = p_workspace_id for update;
  if not found or c.opted_out or c.owner <> 'ai' or c.sales_stage in ('won','lost','contract_sent','post_sale') then
    return 0;
  end if;
  for i in 1 .. coalesce(array_length(p_days, 1), 0) loop
    insert into public.ai_followups (workspace_id, conversation_id, step, due_at, template_name)
    values (p_workspace_id, p_conversation_id, i, now() + make_interval(days => p_days[i]), p_templates[i])
    on conflict (workspace_id, conversation_id, step) do update
      set due_at = excluded.due_at, template_name = excluded.template_name, status = 'scheduled',
          cancel_reason = null, updated_at = now()
      where public.ai_followups.status in ('scheduled','cancelled');
    n := n + 1;
  end loop;
  return n;
end $$;

-- Reserva follow-ups vencidos e transforma em itens de outbox (template) na mesma transação.
create or replace function public.ai_claim_due_followups(p_limit integer default 20)
returns table (followup_id uuid, workspace_id uuid, conversation_id uuid, outbox_id uuid, step integer)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare f record; o_id uuid;
begin
  for f in
    select fu.*, c.owner_version, c.owner, c.opted_out, c.sales_stage, s.followup_enabled, s.ai_enabled, s.mode,
           s.followup_template_language
      from public.ai_followups fu
      join public.ai_conversations c on c.id = fu.conversation_id and c.workspace_id = fu.workspace_id
      left join public.ai_workspace_settings s on s.workspace_id = fu.workspace_id
     where fu.status = 'scheduled' and fu.due_at <= now()
     order by fu.due_at
     limit greatest(p_limit, 1)
     for update of fu skip locked
  loop
    if f.opted_out or f.owner <> 'ai' or f.sales_stage in ('won','lost','contract_sent','post_sale')
       or not coalesce(f.followup_enabled, false) or not coalesce(f.ai_enabled, false) or f.mode <> 'auto'
       or coalesce(f.template_name, '') = '' then
      update public.ai_followups set status = 'cancelled', updated_at = now(),
        cancel_reason = case when f.opted_out then 'opted_out' when f.owner <> 'ai' then 'human_owner'
                             when coalesce(f.template_name, '') = '' then 'no_template' else 'gate_closed' end
       where id = f.id;
      continue;
    end if;
    insert into public.ai_message_outbox (workspace_id, conversation_id, owner_version, idempotency_key,
      content, status, sender_type, message_kind, template_name, template_language)
    values (f.workspace_id, f.conversation_id, f.owner_version, 'followup:' || f.id::text,
      '[follow-up ' || f.step || ': ' || f.template_name || ']', 'pending', 'ai', 'template',
      f.template_name, coalesce(f.followup_template_language, 'pt_BR'))
    on conflict (workspace_id, idempotency_key) do nothing
    returning id into o_id;
    update public.ai_followups set status = 'sent', outbox_id = o_id, updated_at = now() where id = f.id;
    return query select f.id, f.workspace_id, f.conversation_id, o_id, f.step;
  end loop;
end $$;

-- Opt-out (LGPD/consentimento): interrompe remarketing definitivamente.
create or replace function public.ai_opt_out(p_workspace_id uuid, p_conversation_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
begin
  update public.ai_conversations set opted_out = true, opted_out_at = coalesce(opted_out_at, now()), updated_at = now()
   where id = p_conversation_id and workspace_id = p_workspace_id;
  perform public.ai_cancel_followups(p_workspace_id, p_conversation_id, 'opted_out');
end $$;

-- Abre fechamento: invalida o anterior em aberto e registra o resumo enviado (hash).
create or replace function public.ai_open_closing(
  p_workspace_id uuid, p_conversation_id uuid, p_expected_owner_version bigint,
  p_summary jsonb, p_summary_text text, p_summary_hash text
) returns uuid language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare c public.ai_conversations%rowtype; new_id uuid;
begin
  select * into c from public.ai_conversations
   where id = p_conversation_id and workspace_id = p_workspace_id for update;
  if not found or c.owner <> 'ai' or c.owner_version <> p_expected_owner_version then return null; end if;
  if exists (select 1 from public.ai_closings where workspace_id = p_workspace_id
             and conversation_id = p_conversation_id and status in ('confirmed','precontract_created')) then
    return null; -- já em finalização: nunca duplicar
  end if;
  update public.ai_closings set status = 'invalidated', error = 'superseded', updated_at = now()
   where workspace_id = p_workspace_id and conversation_id = p_conversation_id and status = 'awaiting_confirmation';
  insert into public.ai_closings (workspace_id, conversation_id, summary, summary_text, summary_hash, owner_version)
  values (p_workspace_id, p_conversation_id, p_summary, p_summary_text, p_summary_hash, c.owner_version)
  returning id into new_id;
  return new_id;
end $$;

-- Confirmação expressa: só vale para o resumo aguardando e com o mesmo hash.
create or replace function public.ai_confirm_closing(
  p_workspace_id uuid, p_closing_id uuid, p_summary_hash text, p_message_id text
) returns boolean language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare n integer;
begin
  update public.ai_closings set status = 'confirmed', confirmation_message_id = p_message_id, updated_at = now()
   where id = p_closing_id and workspace_id = p_workspace_id and status = 'awaiting_confirmation'
     and summary_hash = p_summary_hash;
  get diagnostics n = row_count;
  return n = 1;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.ai_knowledge_propose(uuid, text, text, text, text, text[], text[], jsonb, integer, text, uuid)',
    'public.ai_knowledge_activate(uuid, uuid, uuid)',
    'public.ai_set_sales_stage(uuid, uuid, text, text)',
    'public.ai_cancel_followups(uuid, uuid, text)',
    'public.ai_schedule_followups(uuid, uuid, integer[], text[])',
    'public.ai_claim_due_followups(integer)',
    'public.ai_opt_out(uuid, uuid)',
    'public.ai_open_closing(uuid, uuid, bigint, jsonb, text, text)',
    'public.ai_confirm_closing(uuid, uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- Intervenção humana também cancela follow-ups automáticos (envolve a RPC existente).
create or replace function public.ai_cancel_followups_on_human()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.owner = 'human' and old.owner = 'ai' then
    update public.ai_followups set status = 'cancelled', cancel_reason = 'human_intervention', updated_at = now()
     where workspace_id = new.workspace_id and conversation_id = new.id and status = 'scheduled';
    update public.ai_closings set status = 'needs_human', error = 'human_intervention', updated_at = now()
     where workspace_id = new.workspace_id and conversation_id = new.id and status = 'awaiting_confirmation';
  end if;
  -- Só mensagem NOVA do cliente (avanço do relógio ou nova não lida) cancela follow-ups.
  if new.last_inbound_at > coalesce(old.last_inbound_at, '-infinity'::timestamptz)
     or new.unread_count > old.unread_count then
    update public.ai_followups set status = 'cancelled', cancel_reason = 'customer_replied', updated_at = now()
     where workspace_id = new.workspace_id and conversation_id = new.id and status = 'scheduled';
  end if;
  return new;
end $$;
revoke all on function public.ai_cancel_followups_on_human() from public, anon, authenticated;
drop trigger if exists ai_conversations_followup_guard on public.ai_conversations;
create trigger ai_conversations_followup_guard
  after update of owner, last_inbound_at, unread_count on public.ai_conversations
  for each row execute function public.ai_cancel_followups_on_human();

-- LGPD: sugestões guardam texto do cliente => somem com a conversa e respeitam a retenção.
alter table public.ai_learning_suggestions
  add constraint ai_learning_conversation_fk
  foreign key (conversation_id, workspace_id) references public.ai_conversations(id, workspace_id) on delete cascade;

create or replace function public.ai_purge_expired_data()
returns table (messages_deleted bigint, events_deleted bigint)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare m bigint; e bigint;
begin
  delete from public.ai_messages msg using public.ai_workspace_settings s
   where s.workspace_id = msg.workspace_id
     and msg.created_at < now() - make_interval(days => s.retention_days);
  get diagnostics m = row_count;
  delete from public.ai_webhook_events where received_at < now() - interval '30 days';
  get diagnostics e = row_count;
  delete from public.ai_learning_suggestions ls using public.ai_workspace_settings s
   where s.workspace_id = ls.workspace_id and ls.status <> 'approved'
     and ls.updated_at < now() - make_interval(days => s.retention_days);
  delete from public.ai_memory_events me using public.ai_workspace_settings s
   where s.workspace_id = me.workspace_id and me.created_at < now() - make_interval(days => s.retention_days);
  return query select m, e;
end $$;
revoke all on function public.ai_purge_expired_data() from public, anon, authenticated;
grant execute on function public.ai_purge_expired_data() to service_role;
