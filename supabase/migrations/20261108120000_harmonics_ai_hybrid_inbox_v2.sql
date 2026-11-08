-- Harmonics AI V2: Inbox híbrido, canal WhatsApp Cloud API (Coexistence), fila transacional,
-- custos, aprovações e retenção. Aditivo e INERTE: nada envia mensagens sem
-- ai_workspace_settings.ai_enabled = true + canal ativo + modo 'auto'. Padrões: desligado.
-- Acesso somente via backend (service_role); anon/authenticated sem privilégios.

-- ---------------------------------------------------------------------------
-- 1) Correções da fundação (V1)
-- ---------------------------------------------------------------------------
-- Integridade de tenant: filhos só podem apontar para conversa do MESMO workspace.
alter table public.ai_conversations
  add constraint ai_conversations_id_workspace_key unique (id, workspace_id);

alter table public.ai_conversations
  add constraint ai_conversations_workspace_fk
  foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.ai_messages
  add constraint ai_messages_conversation_workspace_fk
  foreign key (conversation_id, workspace_id)
  references public.ai_conversations(id, workspace_id) on delete cascade;
alter table public.ai_message_outbox
  add constraint ai_outbox_conversation_workspace_fk
  foreign key (conversation_id, workspace_id)
  references public.ai_conversations(id, workspace_id) on delete cascade;
alter table public.ai_handoffs
  add constraint ai_handoffs_conversation_workspace_fk
  foreign key (conversation_id, workspace_id)
  references public.ai_conversations(id, workspace_id) on delete cascade;

-- Estado de conversa e metadados do Inbox.
alter table public.ai_conversations
  drop constraint if exists ai_conversations_state_check;
alter table public.ai_conversations
  add constraint ai_conversations_state_check check (state in ('open','closed')),
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists needs_human boolean not null default false,
  add column if not exists needs_human_reason text,
  add column if not exists unread_count integer not null default 0,
  add column if not exists last_inbound_at timestamptz,
  add column if not exists last_message_preview text,
  add column if not exists last_message_direction text,
  add column if not exists assigned_user_id uuid,
  add column if not exists memory_summary text,
  add column if not exists lead_data jsonb not null default '{}'::jsonb,
  add column if not exists ai_turns integer not null default 0,
  add column if not exists ai_pending_since timestamptz,
  add column if not exists ai_processing_until timestamptz,
  add column if not exists source text not null default 'cloud_api';
create index if not exists ai_conversations_workspace_last_msg_idx
  on public.ai_conversations(workspace_id, last_message_at desc nulls last);
create index if not exists ai_conversations_ai_pending_idx
  on public.ai_conversations(ai_pending_since) where ai_pending_since is not null;

alter table public.ai_messages
  add column if not exists origin text not null default 'customer'
    check (origin in ('customer','business_app','api_ai','api_human','system','history')),
  add column if not exists status text not null default 'received'
    check (status in ('received','sent','delivered','read','failed','deleted')),
  add column if not exists message_type text not null default 'text',
  add column if not exists media_id text,
  add column if not exists media_mime text,
  add column if not exists transcript text,
  add column if not exists author_user_id uuid,
  add column if not exists error_code text,
  add column if not exists outbox_id uuid;
create index if not exists ai_messages_ws_conv_provider_created_idx
  on public.ai_messages(workspace_id, conversation_id, coalesce(provider_created_at, created_at));

alter table public.ai_message_outbox
  add column if not exists sender_type text not null default 'ai' check (sender_type in ('ai','human')),
  add column if not exists author_user_id uuid,
  add column if not exists attempts integer not null default 0,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_error text,
  add column if not exists sent_at timestamptz;
alter table public.ai_message_outbox drop constraint if exists ai_message_outbox_status_check;
alter table public.ai_message_outbox add constraint ai_message_outbox_status_check
  check (status in ('draft','pending','cancelled','dispatching','sent','failed','unknown'));
create index if not exists ai_outbox_dispatching_lease_idx
  on public.ai_message_outbox(lease_expires_at) where status = 'dispatching';

-- ---------------------------------------------------------------------------
-- 2) Configuração por workspace: kill switch, persona, orçamento
-- ---------------------------------------------------------------------------
create table if not exists public.ai_workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  ai_enabled boolean not null default false,           -- kill switch do workspace
  mode text not null default 'observe' check (mode in ('observe','draft','auto')),
  assistant_name text not null default 'Assistente virtual',
  business_description text,
  tone_notes text,
  daily_ai_reply_limit integer not null default 200 check (daily_ai_reply_limit >= 0),
  daily_cost_limit_usd numeric(10,4) not null default 2.0 check (daily_cost_limit_usd >= 0),
  monthly_cost_limit_usd numeric(10,4) not null default 30.0 check (monthly_cost_limit_usd >= 0),
  max_ai_turns_per_conversation integer not null default 30,
  retention_days integer not null default 365 check (retention_days between 30 and 3650),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Canal WhatsApp Cloud API. Token criptografado na aplicação (AES-GCM, chave fora do banco).
create table if not exists public.ai_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null default 'meta_cloud' check (provider in ('meta_cloud')),
  phone_number_id text not null,
  waba_id text,
  display_phone text,
  access_token_encrypted text,
  coexistence boolean not null default true,
  status text not null default 'draft' check (status in ('draft','active','paused')),
  history_sync_status text not null default 'not_requested'
    check (history_sync_status in ('not_requested','in_progress','completed','declined','failed')),
  last_webhook_at timestamptz,
  last_eligibility jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phone_number_id),            -- webhook → exatamente um workspace
  unique (workspace_id, provider)
);

-- Eventos de webhook: deduplicação + auditoria. payload mínimo, purgado pela retenção.
create table if not exists public.ai_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'meta_cloud',
  dedupe_key text not null,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  kind text not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, dedupe_key)
);
create index if not exists ai_webhook_events_received_idx on public.ai_webhook_events(received_at);

-- Ledger de custo/uso (controle de custos).
create table if not exists public.ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid,
  kind text not null check (kind in ('reply','transcription','summary')),
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_ws_created_idx on public.ai_usage_ledger(workspace_id, created_at);

-- Aprovações humanas: propostas definitivas, descontos, alterações contratuais.
create table if not exists public.ai_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null,
  kind text not null check (kind in ('proposal','discount','contract_change','other')),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, workspace_id)
    references public.ai_conversations(id, workspace_id) on delete cascade
);
create index if not exists ai_approvals_ws_status_idx on public.ai_approvals(workspace_id, status, created_at desc);

alter table public.ai_workspace_settings enable row level security;
alter table public.ai_channels enable row level security;
alter table public.ai_webhook_events enable row level security;
alter table public.ai_usage_ledger enable row level security;
alter table public.ai_approvals enable row level security;
revoke all on public.ai_workspace_settings, public.ai_channels, public.ai_webhook_events,
  public.ai_usage_ledger, public.ai_approvals from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) RPCs transacionais (service_role apenas)
-- ---------------------------------------------------------------------------

-- Correção V1: registra o ator e falha com código estável.
create or replace function public.ai_switch_conversation_owner(
  p_workspace_id uuid, p_conversation_id uuid, p_to_owner text,
  p_reason text default null, p_actor_user_id uuid default null
) returns table (conversation_id uuid, new_owner text, new_owner_version bigint)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare c public.ai_conversations%rowtype;
begin
  if p_to_owner not in ('human','ai') then
    raise exception 'invalid owner' using errcode = '22023';
  end if;
  select * into c from public.ai_conversations
  where id = p_conversation_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'conversation not found in workspace' using errcode = 'P0002'; end if;
  if c.owner = p_to_owner then
    return query select c.id, c.owner, c.owner_version;
    return;
  end if;
  update public.ai_conversations
    set owner = p_to_owner, owner_version = owner_version + 1,
        ai_enabled = case when p_to_owner = 'ai' then true else ai_enabled end,
        needs_human = case when p_to_owner = 'ai' then false else needs_human end,
        needs_human_reason = case when p_to_owner = 'ai' then null else needs_human_reason end,
        assigned_user_id = case when p_to_owner = 'human' then coalesce(p_actor_user_id, assigned_user_id) else null end,
        ai_pending_since = case when p_to_owner = 'human' then null else ai_pending_since end,
        updated_at = now()
    where id = c.id returning * into c;
  update public.ai_message_outbox set status = 'cancelled', updated_at = now()
    where conversation_id = c.id and workspace_id = p_workspace_id
      and status in ('pending','draft') and sender_type = 'ai';
  insert into public.ai_handoffs
    (workspace_id, conversation_id, from_owner, to_owner, reason, actor_user_id)
    values (p_workspace_id, c.id,
      case when p_to_owner = 'human' then 'ai' else 'human' end,
      p_to_owner, p_reason, p_actor_user_id);
  return query select c.id, c.owner, c.owner_version;
end $$;

-- Ingestão idempotente de mensagem (cliente, eco do app Business, histórico).
-- Eco do app Business com conversa em 'ai' => transferência humana na MESMA transação.
create or replace function public.ai_ingest_message(
  p_workspace_id uuid, p_provider_chat_id text, p_provider_message_id text,
  p_direction text, p_origin text, p_message_type text, p_content text,
  p_media_id text default null, p_media_mime text default null,
  p_provider_created_at timestamptz default null, p_contact_name text default null
) returns table (inserted boolean, message_id uuid, conversation_id uuid,
                 owner text, owner_version bigint, took_over boolean)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare
  c public.ai_conversations%rowtype;
  m_id uuid;
  v_sender text;
  v_took boolean := false;
  v_ts timestamptz := coalesce(p_provider_created_at, now());
  v_is_history boolean := p_origin = 'history';
  v_ai_default boolean;
begin
  if p_direction not in ('inbound','outbound') then raise exception 'invalid direction' using errcode = '22023'; end if;
  if coalesce(p_provider_chat_id, '') = '' or coalesce(p_provider_message_id, '') = '' then
    raise exception 'missing identifiers' using errcode = '22023';
  end if;

  -- Conversa nova: IA só assume cliente novo quando o workspace está com IA ligada fora do
  -- modo observação. Histórico/eco do app nascem com a equipe (atendimento já existente).
  select (coalesce(s.ai_enabled, false) and s.mode in ('draft','auto')) into v_ai_default
    from public.ai_workspace_settings s where s.workspace_id = p_workspace_id;
  v_ai_default := coalesce(v_ai_default, false) and p_origin = 'customer';
  insert into public.ai_conversations (workspace_id, provider_chat_id, contact_phone, contact_name, owner, ai_enabled)
  values (p_workspace_id, p_provider_chat_id, p_provider_chat_id, p_contact_name,
          case when v_ai_default then 'ai' else 'human' end, v_ai_default)
  on conflict (workspace_id, provider_chat_id) do nothing;

  select * into c from public.ai_conversations
   where workspace_id = p_workspace_id and provider_chat_id = p_provider_chat_id for update;

  v_sender := case
    when p_direction = 'inbound' then 'customer'
    when p_origin in ('business_app','api_human') then 'human'
    when p_origin = 'api_ai' then 'ai'
    when p_origin = 'history' then 'human'
    else 'system' end;

  insert into public.ai_messages (workspace_id, conversation_id, provider_message_id, direction,
    sender_type, content, media_type, message_type, media_id, media_mime, origin, status, provider_created_at)
  values (p_workspace_id, c.id, p_provider_message_id, p_direction, v_sender, p_content,
    case when p_message_type in ('audio','image','video','document','sticker') then p_message_type end,
    coalesce(p_message_type, 'text'), p_media_id, p_media_mime, p_origin,
    case when p_direction = 'inbound' then 'received' else 'sent' end, v_ts)
  on conflict (workspace_id, provider_message_id) do nothing
  returning id into m_id;

  if m_id is null then
    return query select false, null::uuid, c.id, c.owner, c.owner_version, false;
    return;
  end if;

  -- Eco genuíno do app Business (não originado pela nossa API) => humano assume.
  if p_origin = 'business_app' and c.owner = 'ai' and not exists (
       select 1 from public.ai_message_outbox o
        where o.workspace_id = p_workspace_id and o.provider_message_id = p_provider_message_id) then
    perform public.ai_switch_conversation_owner(p_workspace_id, c.id, 'human',
      'business_app_reply', null);
    v_took := true;
    select * into c from public.ai_conversations where id = c.id;
  end if;

  update public.ai_conversations set
    contact_name = coalesce(nullif(p_contact_name, ''), contact_name),
    last_message_at = greatest(coalesce(last_message_at, v_ts), v_ts),
    last_message_preview = case when v_ts >= coalesce(last_message_at, v_ts)
      then left(coalesce(nullif(p_content, ''), '[' || coalesce(p_message_type, 'mensagem') || ']'), 160)
      else last_message_preview end,
    last_message_direction = case when v_ts >= coalesce(last_message_at, v_ts) then p_direction else last_message_direction end,
    last_inbound_at = case when p_direction = 'inbound' then greatest(coalesce(last_inbound_at, v_ts), v_ts) else last_inbound_at end,
    unread_count = case when p_direction = 'inbound' and not v_is_history then unread_count + 1
                        when p_direction = 'outbound' and not v_is_history then 0 else unread_count end,
    -- Marca a conversa para a IA apenas em mensagem nova de cliente (não histórico).
    ai_pending_since = case when p_direction = 'inbound' and not v_is_history and owner = 'ai'
                            then coalesce(ai_pending_since, now()) else ai_pending_since end,
    state = case when p_direction = 'inbound' and not v_is_history then 'open' else state end,
    updated_at = now()
  where id = c.id returning * into c;

  return query select true, m_id, c.id, c.owner, c.owner_version, v_took;
end $$;

-- Reserva a conversa para geração de resposta (evita duas gerações paralelas).
create or replace function public.ai_claim_conversation_for_reply(
  p_workspace_id uuid, p_conversation_id uuid, p_lease_seconds integer default 90
) returns table (claimed boolean, owner_version bigint)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare c public.ai_conversations%rowtype;
begin
  select * into c from public.ai_conversations
   where id = p_conversation_id and workspace_id = p_workspace_id for update;
  if not found or c.owner <> 'ai' or c.state <> 'open' or c.ai_pending_since is null
     or (c.ai_processing_until is not null and c.ai_processing_until > now()) then
    return query select false, coalesce(c.owner_version, 0::bigint);
    return;
  end if;
  update public.ai_conversations
     set ai_processing_until = now() + make_interval(secs => greatest(p_lease_seconds, 10)),
         ai_pending_since = null
   where id = c.id;
  return query select true, c.owner_version;
end $$;

create or replace function public.ai_release_conversation_reply(
  p_workspace_id uuid, p_conversation_id uuid
) returns void language sql security invoker set search_path = public as $$
  update public.ai_conversations set ai_processing_until = null
   where id = p_conversation_id and workspace_id = p_workspace_id;
$$;

-- Enfileira resposta da IA SOMENTE se a titularidade/versão não mudou (trava a conversa).
-- p_as_draft=true => fica como rascunho para aprovação humana (modo 'draft').
create or replace function public.ai_enqueue_ai_reply(
  p_workspace_id uuid, p_conversation_id uuid, p_expected_owner_version bigint,
  p_idempotency_key text, p_content text, p_as_draft boolean default false
) returns table (outbox_id uuid, status text)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare c public.ai_conversations%rowtype; o_id uuid; v_status text;
begin
  select * into c from public.ai_conversations
   where id = p_conversation_id and workspace_id = p_workspace_id for update;
  if not found or c.owner <> 'ai' or c.owner_version <> p_expected_owner_version or c.state <> 'open' then
    return query select null::uuid, 'rejected'::text;
    return;
  end if;
  v_status := case when p_as_draft then 'draft' else 'pending' end;
  insert into public.ai_message_outbox (workspace_id, conversation_id, owner_version,
    idempotency_key, content, status, sender_type)
  values (p_workspace_id, c.id, c.owner_version, p_idempotency_key, p_content, v_status, 'ai')
  on conflict (workspace_id, idempotency_key) do nothing
  returning id into o_id;
  if o_id is null then
    return query select null::uuid, 'duplicate'::text;
    return;
  end if;
  update public.ai_conversations set ai_turns = ai_turns + 1, updated_at = now() where id = c.id;
  return query select o_id, v_status;
end $$;

-- Mensagem humana enviada pelo Inbox: assume a conversa e enfileira na mesma transação.
create or replace function public.ai_enqueue_human_message(
  p_workspace_id uuid, p_conversation_id uuid, p_actor_user_id uuid,
  p_idempotency_key text, p_content text
) returns table (outbox_id uuid, owner_version bigint)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare c public.ai_conversations%rowtype; o_id uuid;
begin
  select * into c from public.ai_conversations
   where id = p_conversation_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'conversation not found in workspace' using errcode = 'P0002'; end if;
  if c.owner <> 'human' then
    perform public.ai_switch_conversation_owner(p_workspace_id, c.id, 'human', 'human_reply_in_inbox', p_actor_user_id);
    select * into c from public.ai_conversations where id = c.id;
  end if;
  insert into public.ai_message_outbox (workspace_id, conversation_id, owner_version,
    idempotency_key, content, status, sender_type, author_user_id)
  values (p_workspace_id, c.id, c.owner_version, p_idempotency_key, p_content, 'pending', 'human', p_actor_user_id)
  on conflict (workspace_id, idempotency_key) do nothing
  returning id into o_id;
  update public.ai_conversations set unread_count = 0, updated_at = now() where id = c.id;
  return query select o_id, c.owner_version;
end $$;

-- Aprova rascunho da IA: humano assume e o texto vira mensagem humana pendente.
create or replace function public.ai_approve_draft(
  p_workspace_id uuid, p_outbox_id uuid, p_actor_user_id uuid, p_content text default null
) returns table (outbox_id uuid)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare o public.ai_message_outbox%rowtype; c public.ai_conversations%rowtype;
begin
  select * into o from public.ai_message_outbox
   where id = p_outbox_id and workspace_id = p_workspace_id for update;
  if not found or o.status <> 'draft' then
    return query select null::uuid; return;
  end if;
  select * into c from public.ai_conversations
   where id = o.conversation_id and workspace_id = p_workspace_id for update;
  update public.ai_message_outbox
     set status = 'pending', sender_type = 'human', author_user_id = p_actor_user_id,
         owner_version = c.owner_version, content = coalesce(nullif(p_content, ''), content),
         updated_at = now()
   where id = o.id;
  return query select o.id;
end $$;

-- Reserva atômica de envio. Revalida titularidade, versão, kill switch e canal NA MESMA
-- transação; itens obsoletos são cancelados. SKIP LOCKED permite workers concorrentes.
create or replace function public.ai_claim_outbox(
  p_limit integer default 10, p_lease_seconds integer default 60, p_workspace_id uuid default null
) returns setof public.ai_message_outbox
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
begin
  -- Cancela itens que perderam a titularidade (IA após troca de dono, versão antiga).
  update public.ai_message_outbox o set status = 'cancelled', updated_at = now(),
         last_error = 'owner_changed'
    from public.ai_conversations c
   where o.status = 'pending' and c.id = o.conversation_id and c.workspace_id = o.workspace_id
     and (p_workspace_id is null or o.workspace_id = p_workspace_id)
     and o.sender_type = 'ai'
     and (c.owner <> 'ai' or c.owner_version <> o.owner_version);

  return query
  with candidates as (
    select o.id from public.ai_message_outbox o
      join public.ai_conversations c on c.id = o.conversation_id and c.workspace_id = o.workspace_id
      join public.ai_channels ch on ch.workspace_id = o.workspace_id and ch.status = 'active'
      left join public.ai_workspace_settings s on s.workspace_id = o.workspace_id
     where o.status = 'pending'
       and (p_workspace_id is null or o.workspace_id = p_workspace_id)
       and (
         (o.sender_type = 'human' and c.owner = 'human')
         or (o.sender_type = 'ai' and c.owner = 'ai' and c.owner_version = o.owner_version
             and c.state = 'open' and coalesce(s.ai_enabled, false) and s.mode = 'auto')
       )
     order by o.created_at
     limit greatest(p_limit, 1)
     for update of o skip locked
  )
  update public.ai_message_outbox o
     set status = 'dispatching', claimed_at = now(), attempts = o.attempts + 1,
         lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 10)),
         updated_at = now()
    from candidates
   where o.id = candidates.id
  returning o.*;
end $$;

-- Conclusão do envio: grava o resultado e a mensagem no histórico de forma idempotente.
create or replace function public.ai_complete_outbox(
  p_outbox_id uuid, p_status text, p_provider_message_id text default null, p_error text default null
) returns void language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare o public.ai_message_outbox%rowtype;
begin
  if p_status not in ('sent','failed','unknown') then raise exception 'invalid status' using errcode = '22023'; end if;
  select * into o from public.ai_message_outbox where id = p_outbox_id for update;
  if not found or o.status <> 'dispatching' then return; end if;
  update public.ai_message_outbox set status = p_status, provider_message_id = p_provider_message_id,
         last_error = left(p_error, 500), sent_at = case when p_status = 'sent' then now() end,
         lease_expires_at = null, updated_at = now()
   where id = o.id;
  if p_status = 'sent' and p_provider_message_id is not null then
    insert into public.ai_messages (workspace_id, conversation_id, provider_message_id, direction,
      sender_type, content, message_type, origin, status, provider_created_at, author_user_id, outbox_id)
    values (o.workspace_id, o.conversation_id, p_provider_message_id, 'outbound', o.sender_type,
      o.content, 'text', case when o.sender_type = 'ai' then 'api_ai' else 'api_human' end,
      'sent', now(), o.author_user_id, o.id)
    on conflict (workspace_id, provider_message_id) do nothing;
    update public.ai_conversations set last_message_at = now(), last_message_preview = left(o.content, 160),
           last_message_direction = 'outbound', updated_at = now()
     where id = o.conversation_id;
  end if;
end $$;

-- Leases vencidos NÃO são reenviados automaticamente: viram 'unknown' para reconciliação.
create or replace function public.ai_reap_stale_dispatching()
returns integer language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare n integer;
begin
  update public.ai_message_outbox set status = 'unknown', last_error = 'lease_expired', updated_at = now()
   where status = 'dispatching' and lease_expires_at < now();
  get diagnostics n = row_count;
  update public.ai_conversations set ai_processing_until = null
   where ai_processing_until is not null and ai_processing_until < now() - interval '5 minutes';
  return n;
end $$;

-- Status de entrega (sent/delivered/read/failed) vindo do webhook.
create or replace function public.ai_apply_message_status(
  p_workspace_id uuid, p_provider_message_id text, p_status text, p_error_code text default null
) returns boolean language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare rank_new int; n int;
begin
  rank_new := case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3
                            when 'failed' then 4 when 'deleted' then 5 else 0 end;
  if rank_new = 0 then return false; end if;
  update public.ai_messages set status = p_status, error_code = coalesce(p_error_code, error_code)
   where workspace_id = p_workspace_id and provider_message_id = p_provider_message_id
     and (case status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3
                      when 'failed' then 4 when 'deleted' then 5 else 0 end) < rank_new;
  get diagnostics n = row_count;
  -- Reconciliação: um envio 'unknown' confirmado pelo provedor passa a 'sent'.
  update public.ai_message_outbox set status = 'sent', updated_at = now()
   where workspace_id = p_workspace_id and provider_message_id = p_provider_message_id and status = 'unknown';
  return n > 0;
end $$;

-- Uso diário/mensal para o controle de custos (leitura rápida).
create or replace function public.ai_usage_summary(p_workspace_id uuid)
returns table (day_replies bigint, day_cost numeric, month_cost numeric)
language sql security invoker set search_path = public as $$
  select
    count(*) filter (where kind = 'reply' and created_at >= date_trunc('day', now())),
    coalesce(sum(cost_usd) filter (where created_at >= date_trunc('day', now())), 0),
    coalesce(sum(cost_usd) filter (where created_at >= date_trunc('month', now())), 0)
  from public.ai_usage_ledger where workspace_id = p_workspace_id
    and created_at >= date_trunc('month', now());
$$;

-- LGPD: retenção por workspace. Remove mensagens/eventos antigos; nunca toca outras tabelas.
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
  return query select m, e;
end $$;

-- LGPD: exclusão a pedido do titular (todas as conversas daquele número no workspace).
create or replace function public.ai_erase_contact(p_workspace_id uuid, p_provider_chat_id text)
returns integer language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare n integer;
begin
  delete from public.ai_conversations where workspace_id = p_workspace_id and provider_chat_id = p_provider_chat_id;
  get diagnostics n = row_count;
  return n;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.ai_switch_conversation_owner(uuid, uuid, text, text, uuid)',
    'public.ai_ingest_message(uuid, text, text, text, text, text, text, text, text, timestamptz, text)',
    'public.ai_claim_conversation_for_reply(uuid, uuid, integer)',
    'public.ai_release_conversation_reply(uuid, uuid)',
    'public.ai_enqueue_ai_reply(uuid, uuid, bigint, text, text, boolean)',
    'public.ai_enqueue_human_message(uuid, uuid, uuid, text, text)',
    'public.ai_approve_draft(uuid, uuid, uuid, text)',
    'public.ai_claim_outbox(integer, integer, uuid)',
    'public.ai_complete_outbox(uuid, text, text, text)',
    'public.ai_reap_stale_dispatching()',
    'public.ai_apply_message_status(uuid, text, text, text)',
    'public.ai_usage_summary(uuid)',
    'public.ai_purge_expired_data()',
    'public.ai_erase_contact(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

grant select, insert, update, delete on public.ai_conversations, public.ai_messages,
  public.ai_message_outbox, public.ai_handoffs, public.ai_workspace_settings, public.ai_channels,
  public.ai_webhook_events, public.ai_usage_ledger, public.ai_approvals to service_role;
