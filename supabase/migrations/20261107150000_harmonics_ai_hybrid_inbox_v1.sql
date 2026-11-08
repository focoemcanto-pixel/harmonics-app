-- Harmonics AI V1: schema aditivo, sem ativar canais nem enviar mensagens.
-- Aplicar somente após revisão de RLS, backup e execução em staging.
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  contact_id uuid null,
  channel_id uuid null,
  provider_chat_id text not null,
  owner text not null default 'human' check (owner in ('human','ai')),
  state text not null default 'open' check (state in ('open','closed')),
  owner_version bigint not null default 1,
  ai_enabled boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider_chat_id)
);
create index if not exists ai_conversations_workspace_updated_idx
  on public.ai_conversations(workspace_id, updated_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  provider_message_id text,
  direction text not null check (direction in ('inbound','outbound')),
  sender_type text not null check (sender_type in ('customer','human','ai','system')),
  content text,
  media_type text,
  provider_created_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider_message_id)
);
create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages(conversation_id, created_at desc);

create table if not exists public.ai_message_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  owner_version bigint not null,
  idempotency_key text not null,
  content text not null,
  status text not null default 'pending'
    check (status in ('pending','cancelled','dispatching','sent','failed','unknown')),
  provider_message_id text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index if not exists ai_outbox_pending_idx
  on public.ai_message_outbox(workspace_id, status, created_at);

create table if not exists public.ai_handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  from_owner text not null,
  to_owner text not null,
  reason text,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

-- Nenhuma tabela AI pode ser lida por cliente anônimo ou autenticado
-- até a publicação de políticas de workspace explicitamente revisadas.
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_message_outbox enable row level security;
alter table public.ai_handoffs enable row level security;
revoke all on public.ai_conversations, public.ai_messages,
  public.ai_message_outbox, public.ai_handoffs from anon, authenticated;

-- Operação transacional: cancela fila pendente e aumenta versão de proprietário.
-- Autorização de workspace e usuário deve ocorrer em rota de servidor antes de chamar.
-- Função não é exposta a anon/authenticated; service_role é a única via prevista.
create or replace function public.ai_switch_conversation_owner(
  p_workspace_id uuid, p_conversation_id uuid, p_to_owner text,
  p_reason text default null, p_actor_user_id uuid default null
) returns table (conversation_id uuid, new_owner text, new_owner_version bigint)
language plpgsql security invoker set search_path = public as $$
declare c public.ai_conversations%rowtype;
begin
  if p_to_owner not in ('human','ai') then
    raise exception 'invalid owner';
  end if;
  select * into c from public.ai_conversations
  where id = p_conversation_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'conversation not found in workspace'; end if;
  if c.owner = p_to_owner then
    return query select c.id, c.owner, c.owner_version;
    return;
  end if;
  update public.ai_conversations
    set owner = p_to_owner, owner_version = owner_version + 1,
        updated_at = now()
    where id = c.id returning * into c;
  update public.ai_message_outbox set status = 'cancelled', updated_at = now()
    where conversation_id = c.id and workspace_id = p_workspace_id and status = 'pending';
  insert into public.ai_handoffs
    (workspace_id, conversation_id, from_owner, to_owner, reason, actor_user_id)
    values (p_workspace_id, c.id,
      case when p_to_owner = 'human' then 'ai' else 'human' end,
      p_to_owner, p_reason, p_actor_user_id);
  return query select c.id, c.owner, c.owner_version;
end $$;
revoke all on function public.ai_switch_conversation_owner(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.ai_switch_conversation_owner(uuid, uuid, text, text, uuid)
  to service_role;

comment on table public.ai_conversations is
  'Harmonics AI: registros inertes por padrão (owner=human, ai_enabled=false).';
comment on table public.ai_message_outbox is
  'Não conectar diretamente ao envio de WhatsApp: requer worker com lease e verificação atômica da versão/titularidade.';
