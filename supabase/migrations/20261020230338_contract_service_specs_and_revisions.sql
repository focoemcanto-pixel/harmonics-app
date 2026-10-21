-- Additive, opt-in service model. NULL means use the untouched legacy columns.
alter table public.precontracts add column if not exists service_specs jsonb;
alter table public.precontracts add constraint precontracts_service_specs_array
  check (service_specs is null or (jsonb_typeof(service_specs) = 'array' and jsonb_array_length(service_specs) <= 30));

create table public.contract_revisions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id),
  workspace_id uuid not null references public.workspaces(id),
  version integer not null check (version > 0),
  base_version integer,
  status text not null check (status in ('pending','signed','cancelled')),
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  verification_token text,
  snapshot jsonb not null,
  client_form jsonb not null default '{}'::jsonb,
  source_html text not null default '',
  preview_html text not null default '',
  changes jsonb not null default '[]'::jsonb,
  signed_record jsonb,
  signed_html text,
  pdf_url text,
  document_hash text,
  signature_metadata jsonb,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  financial_review_required boolean not null default false,
  unique(contract_id, version)
);
create unique index contract_revisions_one_pending on public.contract_revisions(contract_id) where status='pending';
create index contract_revisions_workspace_contract on public.contract_revisions(workspace_id, contract_id, version desc);
create index contract_revisions_verify on public.contract_revisions(verification_token) where verification_token is not null;
alter table public.contract_revisions enable row level security;
-- Server-only. HTTP endpoints must authenticate administrators or a capability token.
revoke all on public.contract_revisions from anon, authenticated;
grant select, insert, update on public.contract_revisions to service_role;

create function public.create_contract_revision(p_contract uuid, p_workspace uuid, p_actor uuid,
  p_snapshot jsonb, p_source text, p_html text, p_changes jsonb, p_expected_updated_at timestamptz)
returns public.contract_revisions language plpgsql security invoker set search_path = public as $$
declare c public.contracts; p public.precontracts; r public.contract_revisions; v integer; b integer;
begin
  select * into strict c from contracts where id=p_contract and workspace_id=p_workspace for update;
  if c.status <> 'signed' or c.signed_at is null then raise exception 'Contrato precisa estar assinado'; end if;
  if c.updated_at is distinct from p_expected_updated_at then raise exception 'Contrato mudou. Recarregue antes de revisar'; end if;
  select * into strict p from precontracts where id=c.precontract_id and workspace_id=p_workspace for update;
  if exists(select 1 from contract_revisions where contract_id=c.id and status='pending') then raise exception 'Já existe revisão pendente'; end if;
  -- No migration of existing evidence: archive lazily, byte-for-byte, on first revision.
  insert into contract_revisions(contract_id,workspace_id,version,status,snapshot,client_form,signed_record,signed_html,pdf_url,document_hash,signature_metadata,signed_at,verification_token)
  values(c.id,p_workspace,1,'signed',to_jsonb(p),coalesce(c.raw_payload->'client_form','{}'),to_jsonb(c),coalesce(c.signed_html,c.raw_payload->>'signed_contract_html'),c.pdf_url,c.document_hash,coalesce(c.signature_metadata,c.raw_payload->'signature_metadata'),c.signed_at,
    coalesce(c.signature_metadata->>'verification_token',c.signature_metadata->>'validation_token',c.verification_token,c.public_token))
  on conflict (contract_id,version) do nothing;
  select max(version) into v from contract_revisions where contract_id=c.id;
  select max(version) into b from contract_revisions where contract_id=c.id and status='signed';
  insert into contract_revisions(contract_id,workspace_id,version,base_version,status,snapshot,client_form,source_html,preview_html,changes,created_by,financial_review_required)
  values(c.id,p_workspace,v+1,b,'pending',p_snapshot,coalesce(c.raw_payload->'client_form','{}'),p_source,p_html,p_changes,p_actor,
    coalesce((p_snapshot->>'agreed_amount')::numeric,0) <> coalesce(p.agreed_amount,0)) returning * into r;
  return r;
end $$;

create function public.complete_contract_revision(p_revision uuid, p_expected_html text, p_signed_html text,
  p_pdf_url text, p_hash text, p_metadata jsonb)
returns public.contract_revisions language plpgsql security invoker set search_path=public as $$
declare r public.contract_revisions; c public.contracts; p public.precontracts; e public.events; s jsonb; paid numeric;
begin
  -- Same lock order as create: contract, precontract, revision.
  select * into strict r from contract_revisions where id=p_revision;
  select * into strict c from contracts where id=r.contract_id for update;
  select * into strict p from precontracts where id=c.precontract_id and workspace_id=r.workspace_id for update;
  select * into strict r from contract_revisions where id=p_revision for update;
  if r.status='signed' then return r; end if;
  if r.status<>'pending' or r.preview_html<>p_expected_html then raise exception 'Revisão indisponível ou alterada'; end if;
  if (select max(version) from contract_revisions where contract_id=c.id and status='signed') <> r.base_version then raise exception 'Versão vigente mudou'; end if;
  if nullif(p_pdf_url,'') is null or nullif(p_signed_html,'') is null or nullif(p_hash,'') is null then raise exception 'Evidência de assinatura incompleta'; end if;
  s := r.snapshot;
  select * into e from events where id=c.event_id and workspace_id=r.workspace_id for update;
  paid := greatest(coalesce(e.paid_amount,0),0);
  update precontracts set service_specs=s->'service_specs', formation=s->>'formation', instruments=s->>'instruments',
    reception_formation=s->>'reception_formation',reception_instruments=s->>'reception_instruments',reception_hours=coalesce((s->>'reception_hours')::integer,0),
    duration_min=coalesce((s->>'duration_min')::integer,60), event_date=(s->>'event_date')::date,event_time=nullif(s->>'event_time','')::time,
    location_name=s->>'location_name',location_address=s->>'location_address',has_sound=coalesce((s->>'has_sound')::boolean,false),has_transport=coalesce((s->>'has_transport')::boolean,false),
    agreed_amount=(s->>'agreed_amount')::numeric,remaining_amount=greatest((s->>'agreed_amount')::numeric-paid,0),
    payment_method=s->>'payment_method',signal_due_date=nullif(s->>'signal_due_date','')::date,balance_due_date=nullif(s->>'balance_due_date','')::date,
    card_due_date=nullif(s->>'card_due_date','')::date,payment_card=coalesce((s->>'payment_card')::boolean,false),notes=s->>'notes',
    custom_contract_enabled=true,custom_contract_content=r.source_html,custom_contract_rich_html=r.source_html,contract_mode='internal',status='signed'
  where id=p.id;
  -- Existing event/contact/scale/payments remain. No billing insert, no automation.
  update events set formation=s->>'formation',instruments=s->>'instruments',reception_formation=s->>'reception_formation',
    reception_instruments=s->>'reception_instruments',reception_hours=coalesce((s->>'reception_hours')::integer,0),has_reception=coalesce((s->>'reception_hours')::integer,0)>0,
    duration_min=coalesce((s->>'duration_min')::integer,60),event_date=(s->>'event_date')::date,event_time=nullif(s->>'event_time','')::time,
    location_name=s->>'location_name',location_address=s->>'location_address',has_sound=coalesce((s->>'has_sound')::boolean,false),has_transport=coalesce((s->>'has_transport')::boolean,false),
    agreed_amount=(s->>'agreed_amount')::numeric,open_amount=greatest((s->>'agreed_amount')::numeric-paid,0),
    payment_status=case when (s->>'agreed_amount')::numeric<=paid then 'paid' when paid>0 then 'partial' else 'pending' end
  where id=e.id and workspace_id=r.workspace_id;
  update contracts set status='signed',signed_at=(p_metadata->>'signed_at_utc')::timestamptz,signature_name=p_metadata->>'signer_name',
    signed_html=p_signed_html,pdf_url=p_pdf_url,doc_url=null,document_hash=p_hash,verification_token=p_metadata->>'verification_token',signature_metadata=p_metadata,
    raw_payload=coalesce(raw_payload,'{}') || jsonb_build_object('precontract_snapshot',s,'client_form',r.client_form,'signed_contract_html',p_signed_html,'contract_html_snapshot',r.preview_html,'signature_metadata',p_metadata,'current_revision',r.version,'signed_contract_mode','internal','final_generation',jsonb_build_object('mode','internal','pdfUrl',p_pdf_url))
  where id=c.id;
  update contract_revisions set status='signed',signed_html=p_signed_html,pdf_url=p_pdf_url,document_hash=p_hash,signature_metadata=p_metadata,
    verification_token=p_metadata->>'verification_token',signed_at=(p_metadata->>'signed_at_utc')::timestamptz,
    signed_record=(select to_jsonb(x) from contracts x where x.id=c.id)
  where id=r.id returning * into r;
  return r;
end $$;
revoke all on function public.create_contract_revision(uuid,uuid,uuid,jsonb,text,text,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.complete_contract_revision(uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_contract_revision(uuid,uuid,uuid,jsonb,text,text,jsonb,timestamptz) to service_role;
grant execute on function public.complete_contract_revision(uuid,text,text,text,text,jsonb) to service_role;

-- Once captured, signed evidence cannot be rewritten or deleted through any route.
create function public.protect_signed_contract_revision() returns trigger language plpgsql set search_path=public as $$
begin
  if old.status='signed' then raise exception 'Histórico assinado é imutável'; end if;
  return new;
end $$;
create trigger protect_signed_contract_revision before update or delete on public.contract_revisions
for each row execute function public.protect_signed_contract_revision();
