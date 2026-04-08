# Correção de credenciais OAuth Google corrompidas

## 1) Diagnosticar
Execute no SQL Editor do Supabase:

```sql
\i supabase/sql/google_oauth_credentials_diagnostics.sql
```

Ou cole o conteúdo do arquivo manualmente.

## 2) Limpar/remover credenciais inválidas
Rode a migração:

```bash
supabase db push
```

A migração `supabase/migrations/20260408_google_oauth_credentials_cleanup.sql` irá:
1. Converter JSON stringificado para JSONB objeto quando possível.
2. Promover `tokens.refresh_token` para `refresh_token` no topo.
3. Remover linhas inválidas.

## 3) Forçar reautenticação segura
Quando as credenciais estiverem inválidas, chame:

```bash
curl -X POST https://<seu-dominio>/api/google/oauth/force-reauth
```

A resposta devolve `reauthUrl` para iniciar um novo consentimento OAuth com `prompt=consent` e `access_type=offline`.

## 4) Testes automatizados
Execute:

```bash
node --test tests/googleCredentials.test.mjs
```
