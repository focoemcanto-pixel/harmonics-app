# Homologação local (Client Zero) — sem custo, sem dados reais

Snapshot **apenas de schema** de produção (tabelas, constraints, funções/triggers de segurança,
RLS, grants e o catálogo público de planos). Nenhum dado de cliente, nenhum segredo.

Roda o código real do app (bootstrap de workspace, limites de plano, webhook Asaas no formato do
sandbox) e prova o isolamento A×B com RLS real (`set local role authenticated/anon` + claims JWT,
como o PostgREST). Não chama Asaas, WhatsApp, e-mail nem produção.

```bash
# Postgres 16 local (ex.: apt install postgresql-16), escutando em /tmp:54329, usuário postgres.
npm i --no-save pg   # ou PG_MODULE=/caminho/para/pg/lib/index.js
./supabase/local/run.sh
```

`run.sh` recria o banco `harmonics_local` do zero a cada execução e aplica as migrações novas
que estão sendo validadas. O teste recusa qualquer `LOCAL_DB_URL` que não seja local.
Não faz parte do `npm test` (precisa de Postgres).

Fora do alcance local (precisa de Auth/PostgREST hospedados): UI e2e de cadastro/login e o
checkout real no Asaas sandbox.
