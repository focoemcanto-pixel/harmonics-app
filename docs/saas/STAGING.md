# Staging — como criar e reproduzir (Fase 11)

Objetivo: ambiente isolado para Cliente Zero, teste A×B e billing, **sem dados pessoais reais**.

## 1. Banco (escolha uma opção)

**Opção A — Supabase Branch (recomendada, tem custo):** Dashboard do projeto `harmonics-saas-dev` →
Branches → Create branch `staging`. O branch nasce com o schema das migrations registradas e **sem dados**.
> Atenção: só 7 migrations recentes estão registradas em `supabase_migrations`. Antes de criar o branch,
> gere um dump de schema de produção (passo 1.1) e aplique no branch, ou o schema ficará incompleto.

**Opção B — projeto separado `harmonics-staging`:** criar no mesmo org (região us-east-1).

### 1.1 Schema idêntico ao de produção (sem dados)
```bash
supabase db dump --project-ref xsmdnbovjovfvdgnncje --schema public,storage -f prod_schema.sql   # só DDL
psql "$STAGING_DB_URL" -f prod_schema.sql
```
Não use `--data-only`/dumps de dados: contratos, CPFs e comprovantes reais não vão para staging.

### 1.2 Dados fictícios
- Planos: copiar `workspace_plans` (não é dado pessoal): `insert into workspace_plans select * from ...` via dump da tabela.
- Usuários/workspaces: criados pelo próprio fluxo de signup durante o Cliente Zero (não semear auth.users à mão).
- Buckets: criar `contract-pdfs` e `payment-proofs` **privados** no staging.

## 2. Aplicação (Cloudflare Worker de preview)
`wrangler.toml` já suporta `npm run deploy:preview` (`--env preview`). Configure **segredos próprios** do staging:

| Variável | Valor em staging |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | do branch/projeto de staging |
| `NEXT_PUBLIC_APP_URL`, `APP_BASE_URL` | URL do Worker de preview |
| `ASAAS_ENV` | `sandbox` |
| `ASAAS_API_KEY` | chave da conta **sandbox** |
| `ASAAS_WEBHOOK_SECRET` | aleatório (≠ produção) |
| `CRON_SECRET` | aleatório (≠ produção) |
| `ENFORCE_WORKSPACE_PLANS` | `true` |
| `RESEND_*`, `WHATSAPP_*`, `GOOGLE_OAUTH_*` | contas de teste ou vazios (não reutilizar os de produção) |

Supabase Auth (staging): Site URL = URL do preview; Redirect URLs: `/auth/reset-password`, `/login`.
Asaas sandbox: webhook → `https://<preview>/api/webhooks/asaas` com o token do `ASAAS_WEBHOOK_SECRET`.

## 3. Roteiro Cliente Zero (executar em staging)
1. `/signup` → e-mail de confirmação → login → `/onboarding` (5 campos) → "Seu espaço está pronto" → dashboard com checklist.
2. Dashboard vazio, `/eventos`, `/contatos`, `/contratos`, `/pagamentos`, `/repertorios`: estados vazios com ação.
3. Cadastrar cliente e músico; criar evento; gerar pré-contrato; abrir link público; assinar; PDF via `/api/public/files/contract/<token>`.
4. Agenda (`/membro` com o músico), financeiro básico.
5. `/settings/billing` → assinar Starter (CPF de teste do sandbox) → pagar no sandbox → webhook → plano ativo; mudar para Pro; cancelar; reassinar.
6. Limite: no Free, criar o 11º evento do mês pela API → **402 PLAN_LIMIT_REACHED**.
7. Logout/login, recuperação de senha (e-mail → `/auth/reset-password` → nova senha).
8. Mobile 360/768/1280: `SMOKE_BASE_URL=<preview> node tests/e2e/smoke.mjs` + revisão visual.
9. **A×B:** criar workspace B com outro usuário; com a sessão de A chamar diretamente as APIs com IDs de B
   (`/api/events/<id>`, `/api/contracts/<id>/signed-url`, `/api/payments/<id>`, `/api/files/payments/<id>/download`,
   `/api/automation/rules/<id>`, `/api/admin/contract-templates/<id>`) → todas 403/404.
   No banco: `supabase/tests/tenant_isolation_a_vs_b.sql` (ajustar as chaves dos workspaces).
