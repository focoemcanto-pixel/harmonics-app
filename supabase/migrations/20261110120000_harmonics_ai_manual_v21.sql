-- Harmonics AI — Manual Mestre v2.1. Aditivo e INERTE: modo SUPERVISIONADO por padrão
-- (todo link de pré-contrato exige aprovação humana); lembretes desligados.
-- Acesso somente via backend (service_role); anon/authenticated sem privilégios.

-- ---------------------------------------------------------------------------
-- Autonomia progressiva (liberada somente pelo Owner) + auditoria
-- ---------------------------------------------------------------------------
alter table public.ai_workspace_settings
  add column if not exists autonomy_mode text not null default 'supervised',
  add column if not exists assisted_rules jsonb not null default '{}'::jsonb,
  add column if not exists signature_reminders_enabled boolean not null default false,
  add column if not exists signature_reminder_days integer[] not null default '{2,7,12}',
  add column if not exists signature_reminder_templates text[] not null default '{}',
  add column if not exists followup_max integer not null default 2;
alter table public.ai_workspace_settings drop constraint if exists ai_workspace_settings_autonomy_mode_check;
alter table public.ai_workspace_settings add constraint ai_workspace_settings_autonomy_mode_check
  check (autonomy_mode in ('supervised','assisted','autonomous'));

create table if not exists public.ai_autonomy_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_mode text, to_mode text not null,
  rules jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fechamento supervisionado: preparado → aguardando aprovação → aprovado → enviado
-- ---------------------------------------------------------------------------
alter table public.ai_closings
  add column if not exists approval_hash text,
  add column if not exists prepared_snapshot jsonb,
  add column if not exists exception_reasons text[] not null default '{}',
  add column if not exists conventional boolean not null default false,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists approval_mode text,
  add column if not exists sent_at timestamptz,
  add column if not exists link_outbox_id uuid,
  add column if not exists rejected_reason text;
alter table public.ai_closings drop constraint if exists ai_closings_status_check;
alter table public.ai_closings add constraint ai_closings_status_check
  check (status in ('awaiting_confirmation','confirmed','precontract_created','awaiting_approval','approved',
                    'link_sent','signed','expired','cancelled','rejected','invalidated','needs_human','failed'));
drop index if exists public.ai_closings_one_open_idx;
create unique index if not exists ai_closings_one_open_idx
  on public.ai_closings(workspace_id, conversation_id)
  where status in ('awaiting_confirmation','confirmed','precontract_created','awaiting_approval','approved');

-- Envio do link aprovado: humano aprova a versão exata; idempotente por fechamento.
create or replace function public.ai_approve_closing(
  p_workspace_id uuid, p_closing_id uuid, p_approval_hash text, p_actor uuid, p_mode text, p_message text
) returns table (outbox_id uuid, status text)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare cl public.ai_closings%rowtype; c public.ai_conversations%rowtype; o_id uuid;
begin
  select * into cl from public.ai_closings where id = p_closing_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'closing not found' using errcode = 'P0002'; end if;
  if cl.status in ('approved','link_sent') then
    return query select cl.link_outbox_id, 'already_sent'::text; return;
  end if;
  if cl.status <> 'awaiting_approval' then return query select null::uuid, 'not_awaiting'::text; return; end if;
  if cl.approval_hash is distinct from p_approval_hash then return query select null::uuid, 'version_changed'::text; return; end if;
  select * into c from public.ai_conversations where id = cl.conversation_id and workspace_id = p_workspace_id for update;
  insert into public.ai_message_outbox (workspace_id, conversation_id, owner_version, idempotency_key, content, status, sender_type, author_user_id)
  values (p_workspace_id, c.id, c.owner_version, 'closing-link:' || cl.id::text, p_message, 'pending', 'human', p_actor)
  on conflict (workspace_id, idempotency_key) do nothing
  returning id into o_id;
  update public.ai_closings set status = 'approved', approved_by = p_actor, approved_at = now(), approval_mode = p_mode,
         link_outbox_id = coalesce(o_id, link_outbox_id), updated_at = now()
   where id = cl.id;
  return query select o_id, 'approved'::text;
end $$;

-- Claim de envio: o link aprovado por humano sai mesmo com a conversa em atendimento da IA.
create or replace function public.ai_claim_outbox(
  p_limit integer default 10, p_lease_seconds integer default 60, p_workspace_id uuid default null
) returns setof public.ai_message_outbox
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
begin
  update public.ai_message_outbox o set status = 'cancelled', updated_at = now(), last_error = 'owner_changed'
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
         (o.sender_type = 'human' and (c.owner = 'human' or o.idempotency_key like 'closing-link:%'))
         or (o.sender_type = 'ai' and c.owner = 'ai' and c.owner_version = o.owner_version
             and c.state = 'open' and coalesce(s.ai_enabled, false) and s.mode = 'auto')
       )
     order by o.created_at
     limit greatest(p_limit, 1)
     for update of o skip locked
  )
  update public.ai_message_outbox o
     set status = 'dispatching', claimed_at = now(), attempts = o.attempts + 1,
         lease_expires_at = now() + make_interval(secs => greatest(p_lease_seconds, 10)), updated_at = now()
    from candidates where o.id = candidates.id
  returning o.*;
end $$;

-- ---------------------------------------------------------------------------
-- Lembretes de assinatura (tipo de follow-up) e cadência por contexto
-- ---------------------------------------------------------------------------
alter table public.ai_followups
  add column if not exists kind text not null default 'quote',
  add column if not exists precontract_id uuid,
  add column if not exists context text;
alter table public.ai_followups drop constraint if exists ai_followups_kind_check;
alter table public.ai_followups add constraint ai_followups_kind_check check (kind in ('quote','signature'));
alter table public.ai_followups drop constraint if exists ai_followups_workspace_id_conversation_id_step_key;
create unique index if not exists ai_followups_ws_conv_kind_step_idx on public.ai_followups(workspace_id, conversation_id, kind, step);

create or replace function public.ai_schedule_followups(
  p_workspace_id uuid, p_conversation_id uuid, p_days integer[], p_templates text[]
) returns integer language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare i integer; n integer := 0; c public.ai_conversations%rowtype;
begin
  select * into c from public.ai_conversations where id = p_conversation_id and workspace_id = p_workspace_id for update;
  if not found or c.opted_out or c.owner <> 'ai' or c.sales_stage in ('won','lost','contract_sent','post_sale') then return 0; end if;
  for i in 1 .. coalesce(array_length(p_days, 1), 0) loop
    insert into public.ai_followups (workspace_id, conversation_id, kind, step, due_at, template_name)
    values (p_workspace_id, p_conversation_id, 'quote', i, now() + make_interval(days => p_days[i]), p_templates[i])
    on conflict (workspace_id, conversation_id, kind, step) do update
      set due_at = excluded.due_at, template_name = excluded.template_name, status = 'scheduled', cancel_reason = null, updated_at = now()
      where public.ai_followups.status in ('scheduled','cancelled');
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.ai_schedule_signature_reminders(
  p_workspace_id uuid, p_conversation_id uuid, p_precontract_id uuid, p_days integer[], p_templates text[]
) returns integer language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare i integer; n integer := 0;
begin
  for i in 1 .. coalesce(array_length(p_days, 1), 0) loop
    insert into public.ai_followups (workspace_id, conversation_id, kind, step, due_at, template_name, precontract_id)
    values (p_workspace_id, p_conversation_id, 'signature', i, now() + make_interval(days => p_days[i]), p_templates[i], p_precontract_id)
    on conflict (workspace_id, conversation_id, kind, step) do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Claim: follow-ups de orçamento como antes; lembretes de assinatura param se assinado/cancelado/expirado.
create or replace function public.ai_claim_due_followups(p_limit integer default 20)
returns table (followup_id uuid, workspace_id uuid, conversation_id uuid, outbox_id uuid, step integer)
language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare f record; o_id uuid; v_signed boolean; v_pc_status text; v_reason text;
begin
  for f in
    select fu.*, c.owner_version, c.owner, c.opted_out, c.sales_stage, s.followup_enabled, s.ai_enabled, s.mode,
           s.followup_template_language, s.signature_reminders_enabled
      from public.ai_followups fu
      join public.ai_conversations c on c.id = fu.conversation_id and c.workspace_id = fu.workspace_id
      left join public.ai_workspace_settings s on s.workspace_id = fu.workspace_id
     where fu.status = 'scheduled' and fu.due_at <= now()
     order by fu.due_at
     limit greatest(p_limit, 1)
     for update of fu skip locked
  loop
    v_reason := null;
    if f.kind = 'signature' then
      select p.status into v_pc_status from public.precontracts p where p.id = f.precontract_id and p.workspace_id = f.workspace_id;
      select exists (select 1 from public.contracts k where k.precontract_id = f.precontract_id and k.workspace_id = f.workspace_id
                     and (k.status = 'signed' or k.signed_at is not null)) into v_signed;
      if v_signed or v_pc_status in ('signed','assinado') then v_reason := 'signed';
      elsif v_pc_status in ('cancelled','canceled','archived','arquivado','expired') or v_pc_status is null then v_reason := 'precontract_' || coalesce(v_pc_status, 'missing');
      elsif not coalesce(f.signature_reminders_enabled, false) then v_reason := 'gate_closed';
      end if;
    elsif f.sales_stage in ('won','lost','contract_sent','post_sale') or not coalesce(f.followup_enabled, false) then
      v_reason := 'gate_closed';
    end if;
    if v_reason is null and (f.opted_out or f.owner <> 'ai' or not coalesce(f.ai_enabled, false) or f.mode <> 'auto' or coalesce(f.template_name, '') = '') then
      v_reason := case when f.opted_out then 'opted_out' when f.owner <> 'ai' then 'human_owner'
                       when coalesce(f.template_name, '') = '' then 'no_template' else 'gate_closed' end;
    end if;
    if v_reason is not null then
      update public.ai_followups set status = 'cancelled', cancel_reason = v_reason, updated_at = now() where id = f.id;
      continue;
    end if;
    insert into public.ai_message_outbox (workspace_id, conversation_id, owner_version, idempotency_key,
      content, status, sender_type, message_kind, template_name, template_language)
    values (f.workspace_id, f.conversation_id, f.owner_version, 'followup:' || f.id::text,
      '[' || f.kind || ' ' || f.step || ': ' || f.template_name || ']', 'pending', 'ai', 'template',
      f.template_name, coalesce(f.followup_template_language, 'pt_BR'))
    on conflict (workspace_id, idempotency_key) do nothing
    returning id into o_id;
    update public.ai_followups set status = 'sent', outbox_id = o_id, updated_at = now() where id = f.id;
    return query select f.id, f.workspace_id, f.conversation_id, o_id, f.step;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Regiões de preço, participantes e propostas de tabela (pendentes de aprovação)
-- ---------------------------------------------------------------------------
alter table public.ai_service_areas
  add column if not exists price_tier text,
  add column if not exists sound_travel_fee numeric(10,2);

alter table public.ai_approvals drop constraint if exists ai_approvals_kind_check;
alter table public.ai_approvals add constraint ai_approvals_kind_check
  check (kind in ('proposal','discount','contract_change','other','availability_review','pricing_exception',
                  'territory_exception','closing','participant_link','precontract_expiring'));

create table if not exists public.ai_conversation_participants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  conversation_id uuid not null,
  precontract_id uuid,
  event_id uuid,
  role text not null default 'other' check (role in ('contratante','noivo','noiva','familiar','cerimonial','other')),
  permissions text[] not null default '{repertoire}',
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  claimed_text text,
  verified_by uuid, verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, workspace_id) references public.ai_conversations(id, workspace_id) on delete cascade
);
create index if not exists ai_participants_conv_idx on public.ai_conversation_participants(workspace_id, conversation_id, status);

create table if not exists public.ai_pricing_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null,
  category text not null,
  item_key text not null,
  label text not null,
  amount numeric(12,2) not null check (amount >= 0),
  valid_from date,
  valid_until date,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid, decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, source, category, item_key, valid_from)
);

alter table public.ai_autonomy_events enable row level security;
alter table public.ai_conversation_participants enable row level security;
alter table public.ai_pricing_proposals enable row level security;
revoke all on public.ai_autonomy_events, public.ai_conversation_participants, public.ai_pricing_proposals from anon, authenticated;
grant select, insert, update, delete on public.ai_autonomy_events, public.ai_conversation_participants, public.ai_pricing_proposals to service_role;

do $$
declare f text;
begin
  foreach f in array array[
    'public.ai_approve_closing(uuid, uuid, text, uuid, text, text)',
    'public.ai_claim_outbox(integer, integer, uuid)',
    'public.ai_schedule_followups(uuid, uuid, integer[], text[])',
    'public.ai_schedule_signature_reminders(uuid, uuid, uuid, integer[], text[])',
    'public.ai_claim_due_followups(integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
