-- Garante que todo repertoire_config tenha um repertoire_token válido.
-- Protege inclusive eventos criados por contrato direto, sem precontract.

create or replace function public.ensure_repertoire_config_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_id uuid;
  v_client_token text;
  v_workspace_id uuid;
begin
  if new.event_id is null then
    return new;
  end if;

  -- Preserva vínculo válido já existente.
  if new.repertoire_token_id is not null then
    perform 1
    from public.repertoire_tokens rt
    where rt.id = new.repertoire_token_id
      and rt.event_id = new.event_id;

    if found then
      return new;
    end if;

    new.repertoire_token_id := null;
  end if;

  -- Reaproveita o token aberto mais recente e não expirado do evento.
  select rt.id
    into v_token_id
  from public.repertoire_tokens rt
  where rt.event_id = new.event_id
    and lower(coalesce(rt.status, '')) = 'open'
    and (rt.expires_at is null or rt.expires_at > now())
  order by rt.created_at desc
  limit 1;

  -- Se não existir, cria um novo token para o evento.
  if v_token_id is null then
    select e.workspace_id
      into v_workspace_id
    from public.events e
    where e.id = new.event_id;

    insert into public.repertoire_tokens (
      event_id,
      token,
      status,
      workspace_id
    )
    values (
      new.event_id,
      gen_random_uuid()::text,
      'open',
      v_workspace_id
    )
    returning id into v_token_id;
  end if;

  new.repertoire_token_id := v_token_id;

  -- Mantém o link público já utilizado pelo cliente.
  -- Contrato direto tem prioridade; precontract entra como fallback.
  if nullif(trim(coalesce(new.client_public_token, '')), '') is null then
    select c.public_token
      into v_client_token
    from public.contracts c
    where c.event_id = new.event_id
      and nullif(trim(coalesce(c.public_token, '')), '') is not null
    order by c.created_at desc
    limit 1;

    if v_client_token is null then
      select p.public_token
        into v_client_token
      from public.precontracts p
      where p.event_id = new.event_id
        and nullif(trim(coalesce(p.public_token, '')), '') is not null
      order by p.created_at desc
      limit 1;
    end if;

    new.client_public_token := v_client_token;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ensure_repertoire_config_token
on public.repertoire_config;

create trigger trg_ensure_repertoire_config_token
before insert or update of event_id, repertoire_token_id, client_public_token
on public.repertoire_config
for each row
execute function public.ensure_repertoire_config_token();

-- Backfill idempotente dos registros existentes.
-- O UPDATE aciona o trigger acima sem alterar o conteúdo do repertório.
update public.repertoire_config rc
set updated_at = coalesce(rc.updated_at, now())
where rc.repertoire_token_id is null
   or not exists (
     select 1
     from public.repertoire_tokens rt
     where rt.id = rc.repertoire_token_id
       and rt.event_id = rc.event_id
   );
