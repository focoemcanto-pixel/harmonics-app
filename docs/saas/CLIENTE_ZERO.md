# Cliente Zero SaaS — plano mínimo e checklist (2026-10-15)

## 1. Pré-requisitos (dependem do dono da conta)
| # | Item | Por que | Como |
|---|---|---|---|
| P1 | Projeto Supabase de staging separado (`harmonics-staging`) | Branch do Supabase não serve: só 12 migrations estão registradas e o banco tem 60 tabelas; um branch nasce com schema incompleto | Dashboard → New project (mesma org, us-east-1). Custo do plano Supabase. |
| P2 | Schema de produção sem dados | Reproduzir o banco real | `supabase db dump --db-url "<url de produção>" --schema public,storage -f prod_schema.sql` e aplicar no staging (`psql "<url staging>" -f prod_schema.sql`). Sem `--data`: nenhum CPF/contrato/comprovante real. Copiar só `workspace_plans` (catálogo). |
| P3 | Worker de staging | Isolar do domínio real | `npm run deploy:preview` (env `preview` do wrangler) com secrets próprios (tabela abaixo). |
| P4 | Conta Asaas **sandbox** | Assinatura sem cobrança real | sandbox.asaas.com → API key; Webhook → `https://<staging>/api/webhooks/asaas`, token = `ASAAS_WEBHOOK_SECRET` do staging, eventos de cobrança + assinatura. |
| P5 | Auth do staging | E-mails e redirecionamentos | Site URL = URL do staging; Redirect URLs: `/auth/reset-password`, `/login`; leaked password protection ON. |

Secrets do staging (nunca reutilizar os de produção): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (staging) · `NEXT_PUBLIC_APP_URL`/`APP_BASE_URL` (URL staging) · `ASAAS_ENV=sandbox`, `ASAAS_API_KEY` (sandbox), `ASAAS_WEBHOOK_SECRET` · `CRON_SECRET`, `INTERNAL_API_KEY` (aleatórios) · `ENFORCE_WORKSPACE_PLANS=true` · WhatsApp: canal de teste próprio ou vazio · Google OAuth: vazio (contratos pelo motor interno).
Buckets no staging: nascem **privados** (código já cria `contract-pdfs` privado; criar `payment-proofs` privado).

## 2. Roteiro do Cliente Zero (usuário novo, e-mail nunca usado na Harmonics)
| # | Passo | Resultado esperado |
|---|---|---|
| 1 | Staging no ar (`/login` abre) | 200 |
| 2 | Banco separado | URL do Supabase do staging ≠ produção |
| 3 | Asaas sandbox | `/settings/billing` mostra planos; assinatura gera link sandbox |
| 4 | Usuário novo | nenhum dado da Harmonics visível em nenhuma tela |
| 5 | `/signup` | conta criada |
| 6 | Confirmação de e-mail | link leva ao app logado |
| 7 | Recuperação de senha | e-mail → `/auth/reset-password` → nova senha → login |
| 8 | `/onboarding` (5 campos) | "Seu espaço está pronto." → dashboard com checklist |
| 9 | Workspace | 1 workspace, usuário `owner`, plano Free |
| 10 | Contatos | cliente + músico criados |
| 11 | Eventos | evento criado; 11º evento do mês no Free → 402 |
| 12 | Escala | aba Escala carrega equipe/templates do próprio workspace |
| 13 | Contratos | pré-contrato → link público → assinatura → "Abrir PDF" (bucket privado) |
| 14 | Arquivos | comprovante enviado pelo portal abre via link do portal; admin abre pelo botão assinado |
| 15 | Automações | Central carrega; envio de teste só para número próprio |
| 16 | Assinatura | Starter no sandbox → pagar → webhook → plano ativo; trocar p/ Pro |
| 17 | Limites | limites do plano refletem no backend (402) |
| 18 | Cancelamento | cancelar → acesso até fim do período → depois Free |

## 3. Prova de isolamento (Cliente Zero × Harmonics)
- Com a sessão do Cliente Zero, chamar com IDs da Harmonics (copiados do banco de produção **não**; usar um segundo workspace do staging): `/api/events/<id>`, `/api/contracts/<id>/signed-url`, `/api/payments/<id>/proof-signed-url`, `/api/files/payments/<id>/download`, `/api/automation/rules/<id>`, `/api/admin/contract-templates/<id>` → 403/404.
- Links públicos: token do evento A não abre comprovante do evento B (`/api/public/files/payment-proof/<tokenA>/<pagamentoB>` → 404).
- Banco: `supabase/tests/tenant_isolation_a_vs_b.sql` com as chaves dos dois workspaces do staging.
- Produção: nenhuma linha nova em `workspaces`/`auth.users` de produção durante o teste.
