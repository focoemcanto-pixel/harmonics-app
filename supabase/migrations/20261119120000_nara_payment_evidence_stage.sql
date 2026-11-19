-- Nara / WhatsApp: evidence intake only. NO real payment, cash, or ledger write.
-- Apply in staging first; capture remains disabled unless explicitly enabled server-side.
create table if not exists public.ai_payment_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null,
  message_id uuid not null references public.ai_messages(id) on delete cascade,
  provider_message_id text not null,
  media_kind text not null check (media_kind in ('image','document')),
  media_mime text,
  status text not null default 'candidate'
    check (status in ('candidate','extracted','matched','needs_review','reconciled','rejected')),
  event_id uuid references public.events(id) on delete set null,
  amount_cents bigint check (amount_cents is null or amount_cents > 0),
  payment_on date,
  evidence_sha256 text check (evidence_sha256 is null or evidence_sha256 ~ '^[0-9a-f]{64}$'),
  bank_reference text,
  extracted_at timestamptz,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_payment_evidence_conversation_workspace_fk
    foreign key (conversation_id,workspace_id)
    references public.ai_conversations(id,workspace_id) on delete cascade,
  constraint ai_payment_evidence_workspace_message_unique unique (workspace_id,message_id),
  constraint ai_payment_evidence_workspace_provider_unique unique (workspace_id,provider_message_id),
  constraint ai_payment_evidence_matched_requirements check
    (status not in ('matched','reconciled') or (event_id is not null and amount_cents is not null)),
  constraint ai_payment_evidence_reconciled_requirements check
    (status <> 'reconciled' or (reconciled_at is not null and nullif(btrim(bank_reference),'') is not null))
);
create index if not exists ai_payment_evidence_review_idx
  on public.ai_payment_evidence(workspace_id,status,created_at desc);
create unique index if not exists ai_payment_evidence_digest_idx
  on public.ai_payment_evidence(workspace_id,evidence_sha256)
  where evidence_sha256 is not null;

-- Prevent mismatched event/workspace and changing the source message after intake.
create or replace function public.ai_payment_evidence_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op='UPDATE' and (
    new.workspace_id is distinct from old.workspace_id or
    new.conversation_id is distinct from old.conversation_id or
    new.message_id is distinct from old.message_id or
    new.provider_message_id is distinct from old.provider_message_id
  ) then
    raise exception 'evidence source is immutable';
  end if;
  if new.event_id is not null and not exists (
    select 1 from public.events e
    where e.id=new.event_id and e.workspace_id=new.workspace_id
  ) then
    raise exception 'evidence event workspace mismatch';
  end if;
  -- A "matched" status is a proof claim, NOT confirmation of a bank credit.
  -- Bank reconciliation requires explicit reference from the cash-flow integration.
  if new.status='reconciled' and (new.bank_reference is null or new.reconciled_at is null) then
    raise exception 'bank reconciliation evidence required';
  end if;
  new.updated_at=now();
  return new;
end $$;
drop trigger if exists trg_ai_payment_evidence_guard on public.ai_payment_evidence;
create trigger trg_ai_payment_evidence_guard
  before insert or update on public.ai_payment_evidence
  for each row execute function public.ai_payment_evidence_guard();

alter table public.ai_payment_evidence enable row level security;
revoke all on public.ai_payment_evidence from public, anon, authenticated;
grant select,insert,update,delete on public.ai_payment_evidence to service_role;
comment on table public.ai_payment_evidence is
  'WhatsApp proof candidate/extraction. NOT an operational cash receipt. Bank confirmation belongs to the external finance reconciliation.';
