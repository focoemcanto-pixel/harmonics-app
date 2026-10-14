-- Regressão/segurança da Fase 0 contra o banco real, sem persistir nada.
-- Cada bloco termina com RAISE EXCEPTION -> a transação é sempre revertida.
-- Resultado esperado: a mensagem do erro lista falhas entre colchetes; "[]" = tudo ok.
-- Executar cada bloco separadamente (via SQL editor ou MCP).

-- Bloco 1: admin da Harmonics (browser) continua operando
do $$ declare admin_id uuid; n int; failed text := ''; begin
  select p.id into admin_id from profiles p join workspace_members wm on wm.user_id=p.id join workspaces w on w.id=wm.workspace_id
   where lower(p.role) = 'admin' and w.key='default' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from events; if n = 0 then failed := failed || 'A1;'; end if;
  select count(*) into n from contracts; if n = 0 then failed := failed || 'A2;'; end if;
  select count(*) into n from payments; if n = 0 then failed := failed || 'A3;'; end if;
  select count(*) into n from pricing_settings; if n = 0 then failed := failed || 'A4;'; end if;
  update pricing_settings set price_solo = price_solo where slug='default'; get diagnostics n = row_count; if n <> 1 then failed := failed || 'A5;'; end if;
  select count(*) into n from scale_templates; if n = 0 then failed := failed || 'A6;'; end if;
  execute 'reset role';
  raise exception 'ADMIN [%]', failed;
end $$;

-- Bloco 2: usuário SaaS comum não acessa outro tenant nem vira admin
do $$ declare member_id uuid; ws uuid; n int; failed text := ''; begin
  select wm.user_id into member_id from workspace_members wm join profiles p on p.id = wm.user_id where lower(coalesce(p.role,'')) = 'member' limit 1;
  select id into ws from workspaces where key='default';
  perform set_config('request.jwt.claims', json_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from events where workspace_id = ws; if n <> 0 then failed := failed || 'B1;'; end if;
  select count(*) into n from contracts; if n <> 0 then failed := failed || 'B1b;'; end if;
  update pricing_settings set price_solo = price_solo where slug='default'; get diagnostics n = row_count; if n <> 0 then failed := failed || 'B2;'; end if;
  begin perform 1 from google_oauth_credentials limit 1; failed := failed || 'B3;'; exception when insufficient_privilege then null; end;
  begin perform 1 from workspace_settings limit 1; failed := failed || 'B4;'; exception when insufficient_privilege then null; end;
  begin update profiles set role='admin' where id=member_id; failed := failed || 'B5;'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  raise exception 'MEMBER [%]', failed;
end $$;

-- Bloco 3: anônimo (chave pública do bundle) não lê nem altera tabelas privadas
do $$ declare n int; failed text := ''; begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin perform 1 from google_oauth_credentials limit 1; failed := failed || 'C1;'; exception when insufficient_privilege then null; end;
  begin perform 1 from pricing_settings limit 1; failed := failed || 'C2;'; exception when insufficient_privilege then null; end;
  begin perform 1 from users limit 1; failed := failed || 'C3;'; exception when insufficient_privilege then null; end;
  begin perform 1 from suggestion_songs limit 1; failed := failed || 'C4;'; exception when insufficient_privilege then null; end;
  begin perform 1 from workspace_settings limit 1; failed := failed || 'C5;'; exception when insufficient_privilege then null; end;
  select count(*) into n from workspace_plans; if n = 0 then failed := failed || 'C6;'; end if;
  begin update workspace_plans set monthly_price = monthly_price where slug='free'; failed := failed || 'C7;'; exception when insufficient_privilege then null; end;
  begin perform public.current_user_is_admin(); failed := failed || 'C8;'; exception when insufficient_privilege then null; end;
  execute 'reset role';
  raise exception 'ANON [%]', failed;
end $$;
