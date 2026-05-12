-- Workspace Consistency Triggers
-- Execute depois de 20260512_workspace_enforcement_phase1.sql.
-- Objetivo:
-- impedir inconsistência entre registros relacionados.
-- Exemplos bloqueados:
-- - payment.workspace_id diferente de event.workspace_id
-- - contract.workspace_id diferente de precontract/event
-- - precontract.workspace_id diferente de event.workspace_id

begin;

create or replace function public.ensure_precontract_workspace_consistency()
returns trigger
language plpgsql
as $$
declare
  event_workspace_id uuid;
begin
  if new.event_id is not null then
    select workspace_id into event_workspace_id
    from public.events
    where id = new.event_id;

    if event_workspace_id is null then
      raise exception 'Evento % não encontrado ou sem workspace_id', new.event_id;
    end if;

    if new.workspace_id is null then
      new.workspace_id := event_workspace_id;
    elsif new.workspace_id <> event_workspace_id then
      raise exception 'precontract.workspace_id (%) difere de event.workspace_id (%)', new.workspace_id, event_workspace_id;
    end if;
  end if;

  if new.workspace_id is null then
    raise exception 'precontract.workspace_id é obrigatório';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_contract_workspace_consistency()
returns trigger
language plpgsql
as $$
declare
  precontract_workspace_id uuid;
  event_workspace_id uuid;
begin
  if new.precontract_id is not null then
    select workspace_id into precontract_workspace_id
    from public.precontracts
    where id = new.precontract_id;

    if precontract_workspace_id is null then
      raise exception 'Pré-contrato % não encontrado ou sem workspace_id', new.precontract_id;
    end if;

    if new.workspace_id is null then
      new.workspace_id := precontract_workspace_id;
    elsif new.workspace_id <> precontract_workspace_id then
      raise exception 'contract.workspace_id (%) difere de precontract.workspace_id (%)', new.workspace_id, precontract_workspace_id;
    end if;
  end if;

  if new.event_id is not null then
    select workspace_id into event_workspace_id
    from public.events
    where id = new.event_id;

    if event_workspace_id is null then
      raise exception 'Evento % não encontrado ou sem workspace_id', new.event_id;
    end if;

    if new.workspace_id is null then
      new.workspace_id := event_workspace_id;
    elsif new.workspace_id <> event_workspace_id then
      raise exception 'contract.workspace_id (%) difere de event.workspace_id (%)', new.workspace_id, event_workspace_id;
    end if;
  end if;

  if new.workspace_id is null then
    raise exception 'contract.workspace_id é obrigatório';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_payment_workspace_consistency()
returns trigger
language plpgsql
as $$
declare
  event_workspace_id uuid;
begin
  if new.event_id is not null then
    select workspace_id into event_workspace_id
    from public.events
    where id = new.event_id;

    if event_workspace_id is null then
      raise exception 'Evento % não encontrado ou sem workspace_id', new.event_id;
    end if;

    if new.workspace_id is null then
      new.workspace_id := event_workspace_id;
    elsif new.workspace_id <> event_workspace_id then
      raise exception 'payment.workspace_id (%) difere de event.workspace_id (%)', new.workspace_id, event_workspace_id;
    end if;
  end if;

  if new.workspace_id is null then
    raise exception 'payment.workspace_id é obrigatório';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_precontracts_workspace_consistency on public.precontracts;
create trigger trg_precontracts_workspace_consistency
before insert or update of workspace_id, event_id
on public.precontracts
for each row
execute function public.ensure_precontract_workspace_consistency();

drop trigger if exists trg_contracts_workspace_consistency on public.contracts;
create trigger trg_contracts_workspace_consistency
before insert or update of workspace_id, precontract_id, event_id
on public.contracts
for each row
execute function public.ensure_contract_workspace_consistency();

drop trigger if exists trg_payments_workspace_consistency on public.payments;
create trigger trg_payments_workspace_consistency
before insert or update of workspace_id, event_id
on public.payments
for each row
execute function public.ensure_payment_workspace_consistency();

commit;

-- Teste manual sugerido:
-- tentar inserir payment com event_id de um workspace e workspace_id de outro deve falhar.
