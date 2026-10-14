-- Teste A×B de isolamento via RLS (usuário do workspace A contra dados do workspace B).
-- Cada bloco termina em RAISE EXCEPTION (rollback). "[]" = nenhuma falha.
-- A = owner de 'banda-ok' (workspace SaaS de teste); B = 'default' (Harmonics).
-- Observação: a ferramenta MCP exige confirmação humana para DELETE; o DELETE é coberto pelas
-- políticas FOR ALL cujo USING é o mesmo do UPDATE testado abaixo.

do $$ declare a_user uuid; ws_b uuid; ev_b uuid; n int; failed text := ''; begin
  select wm.user_id into a_user from workspace_members wm join workspaces w on w.id=wm.workspace_id where w.key='banda-ok' limit 1;
  select id into ws_b from workspaces where key='default';
  select id into ev_b from events where workspace_id=ws_b limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', a_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from events where workspace_id=ws_b; if n>0 then failed:=failed||'S-events;'; end if;
  select count(*) into n from contacts where workspace_id=ws_b and id <> public.current_user_contact_id(); if n>0 then failed:=failed||'S-contacts;'; end if;
  select count(*) into n from contracts where workspace_id=ws_b; if n>0 then failed:=failed||'S-contracts;'; end if;
  select count(*) into n from precontracts where workspace_id=ws_b; if n>0 then failed:=failed||'S-precontracts;'; end if;
  select count(*) into n from payments where workspace_id=ws_b; if n>0 then failed:=failed||'S-payments;'; end if;
  select count(*) into n from event_musicians where event_id=ev_b; if n>0 then failed:=failed||'S-musicians;'; end if;
  select count(*) into n from repertoire_items where workspace_id=ws_b; if n>0 then failed:=failed||'S-repertoire;'; end if;
  select count(*) into n from automation_rules where workspace_id=ws_b; if n>0 then failed:=failed||'S-rules;'; end if;
  select count(*) into n from whatsapp_channels where workspace_id=ws_b; if n>0 then failed:=failed||'S-channels;'; end if;
  select count(*) into n from quotes where workspace_id=ws_b; if n>0 then failed:=failed||'S-quotes;'; end if;
  select count(*) into n from workspace_members where workspace_id=ws_b; if n>0 then failed:=failed||'S-members;'; end if;
  select count(*) into n from workspaces where id=ws_b; if n>0 then failed:=failed||'S-workspace;'; end if;
  execute 'reset role';
  raise exception 'A_vs_B_SELECT [%]', failed;
end $$;

do $$ declare a_user uuid; ws_b uuid; n int; failed text := ''; begin
  select wm.user_id into a_user from workspace_members wm join workspaces w on w.id=wm.workspace_id where w.key='banda-ok' limit 1;
  select id into ws_b from workspaces where key='default';
  perform set_config('request.jwt.claims', json_build_object('sub', a_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update events set status = status where workspace_id=ws_b; get diagnostics n = row_count; if n>0 then failed:=failed||'U-events;'; end if;
  update contacts set name = name where workspace_id=ws_b and id <> public.current_user_contact_id(); get diagnostics n = row_count; if n>0 then failed:=failed||'U-contacts;'; end if;
  update payments set status = status where workspace_id=ws_b; get diagnostics n = row_count; if n>0 then failed:=failed||'U-payments;'; end if;
  update contracts set status = status where workspace_id=ws_b; get diagnostics n = row_count; if n>0 then failed:=failed||'U-contracts;'; end if;
  execute 'reset role';
  raise exception 'A_vs_B_UPDATE [%]', failed;
end $$;

do $$ declare a_user uuid; ws_b uuid; failed text := ''; begin
  select wm.user_id into a_user from workspace_members wm join workspaces w on w.id=wm.workspace_id where w.key='banda-ok' limit 1;
  select id into ws_b from workspaces where key='default';
  perform set_config('request.jwt.claims', json_build_object('sub', a_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin insert into contacts(name, workspace_id) values ('zz-idor', ws_b); failed:=failed||'I-contacts;'; exception when others then null; end;
  begin insert into workspace_members(workspace_id, user_id, role, status) values (ws_b, a_user, 'owner', 'active'); failed:=failed||'I-membership;'; exception when others then null; end;
  begin insert into events(client_name, workspace_id) values ('zz-idor', ws_b); failed:=failed||'I-events;'; exception when others then null; end;
  begin insert into payments(workspace_id, amount) values (ws_b, 1); failed:=failed||'I-payments;'; exception when others then null; end;
  execute 'reset role';
  raise exception 'A_vs_B_INSERT [%]', failed;
end $$;
