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

A resposta:
- invalida credenciais ativas no Supabase (`is_active=false`);
- tenta revogar permissões/tokens anteriores no Google (`oauth2.revokeToken`);
- devolve `reauthUrl` + `state` aleatório para iniciar um novo consentimento OAuth com `prompt=consent` e `access_type=offline`.

### Fluxo de reautenticação recomendado
1. Chame `POST /api/google/oauth/force-reauth` quando `refresh_token` estiver ausente/corrompido.
2. Redirecione o operador para `reauthUrl`.
3. Após consentimento, o Google redireciona para `GET /api/google/oauth/callback?code=...`.
4. O callback troca `code` por tokens e valida explicitamente o payload.
5. Se houver `refresh_token` válido, persiste em `public.google_oauth_credentials.credentials` como objeto JSONB.
6. Se o payload vier inválido/sem `refresh_token`, o callback invalida as credenciais locais e devolve nova `reauthUrl`.

### Armazenamento e normalização de tokens
- O backend aceita formatos legados (string pura, JSON serializado, `tokens.refresh_token`) e normaliza para `{ "refresh_token": "..." }`.
- Antes de `setCredentials()`, as credenciais são validadas e reduzidas para um objeto seguro com campos OAuth esperados (`refresh_token`, `access_token`, `token_type`, `expiry_date`).
- Nunca persistir string JSON dupla na coluna `credentials` (jsonb).

### Migração de credenciais antigas
- A migração `20260408_google_oauth_credentials_cleanup.sql` converte strings JSON para objeto, promove `tokens.refresh_token` e remove registros inválidos.
- Execute diagnóstico (`supabase/sql/google_oauth_credentials_diagnostics.sql`) antes/depois da migração para confirmar o saneamento.

## 4) Testes automatizados
Execute:

```bash
node --test tests/googleCredentials.test.mjs
```
