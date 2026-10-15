# Fechamento SaaS — storage, segredos, Asaas e Cliente Zero (2026-10-15)

Baseline: `main` em `76e0927` (#735 e #736 em produção). Verificações em produção somente leitura.

## A. Storage — inventário de consumidores

Dados (produção): bucket `contract-pdfs` (público, 119 objetos) e `payment-proofs` (público, 27 objetos).
`contracts.pdf_url`: 71 URLs públicas do storage, 5 Google Drive, 20 vazias. `payments.proof_file_url`: 24 caminhos do
bucket (sem host), 1 URL pública. Os 71 PDFs e os 25 comprovantes existem no bucket, passam na checagem de bucket/workspace
dos endpoints e todos os 76 contratos com PDF são alcançáveis por algum token do portal.
`repertoire-pdfs` não existe (o salvamento de PDF de repertório falha fechado com `BUCKET_MISSING`); `repertoire_pdf_url`
(39 linhas) não aponta para o storage.

Classes: 1 autenticado · 2 público por token · 3 link enviado ao cliente/admin · 4 backend/integração · 5 legado.

| # | Consumidor | Classe | Antes | Depois da privatização | Estado |
|---|---|---|---|---|---|
| 1 | Admin → Contratos → "PDF final" (`ContractCard`) | 1 | `/api/contracts/[id]/signed-url` | igual | já migrado (#735) |
| 2 | Admin → Evento → "Abrir PDF anexado" (`ContractSignedPdfButton`) | 1 | signed-url | igual | já migrado |
| 3 | Admin → Pagamentos → comprovante (`/api/storage/payment-proof/preview`, `ProofSignedButton`) | 1 | signed URL | igual | já migrado |
| 4 | Admin → Contratos → exportar CSV (coluna PDF) | 1 | URL pública | `/api/files/contracts/<id>/download` (Drive inalterado) | **migrado** |
| 5 | Admin → importar contrato externo → "Ver PDF" | 1 | URL pública | `/api/files/contracts/<id>/download` | **migrado** |
| 6 | Portal do cliente → "Abrir PDF assinado" | 2 | URL pública | `/api/public/files/contract/<token>?c=<id>` | **migrado** |
| 7 | Portal do cliente → "Ver comprovante" | 2 | caminho cru (link quebrado em 24/25) | `/api/public/files/payment-proof/<token>?p=<id>` (novo) | **migrado** (corrige link quebrado) |
| 8 | `/contrato/<token>` → "Abrir PDF" / guia pós-assinatura | 2 | URL pública | `/api/public/files/contract/<token>?c=<id>` | **migrado** |
| 9 | `/verify/<token>` → "Abrir PDF assinado" | 2 | URL pública | `/api/public/files/contract/<token>?c=<id>` | **migrado** |
| 10 | WhatsApp "contrato assinado" ao admin (`{pdf_url}`/`{link_pdf}`) | 3 | URL pública | link absoluto do endpoint por token | **migrado** |
| 11 | Mensagens já enviadas com URL pública | 3 | URL pública | **deixam de abrir** | 4 mensagens (todas ao admin, última em 2026-05-04) — aceitável |
| 12 | Geração/assinatura de PDF (`internalPdfFlow`, `external-contract-flow`, `sign-internal-contract`) | 4 | grava URL pública em `pdf_url` | igual — o valor vira só localizador (os endpoints extraem bucket/caminho) | sem mudança necessária |
| 13 | Upload de comprovante pelo cliente (`/api/cliente/pagamentos`) | 4 | grava caminho | igual (service role) | sem mudança |
| 14 | Exclusões em cascata, `storage-migrations`, `contracts/[id]` DELETE | 4 | service role | igual | sem mudança |
| 15 | Prévia GAS (`/api/contracts/preview`), serviço externo HTML→PDF | 4 | URL do serviço externo (não é nosso storage) | igual | não afetado |
| 16 | Área do membro (`membro-invites`, `global-dashboard`) | — | lê `pdf_url` mas não renderiza link | — | não é consumidor |
| 17 | `saveRepertoirePdf` (`getPublicUrl` em `repertoire-pdfs`) | 5 | bucket inexistente | — | legado, fora do escopo |
| 18 | `debug/*` | 5 | 404 salvo flag + admin de plataforma | — | não é consumidor |

Mecanismos reaproveitados (nenhuma arquitetura nova): endpoint público por token do #735
(`/api/public/files/contract/<token>`, URL assinada de 10 min) — agora aceita `?c=<id>` apenas se o contrato estiver no
escopo do token — e os endpoints autenticados do #735 (`signed-url`, `files/*/download`). O endpoint de comprovante por
token segue o mesmo modelo. O escopo do token cobre os mesmos três tipos de token que o portal aceita
(`precontracts.public_token`, `contracts.public_token`, `repertoire_config.client_public_token`).

### GO / NO-GO
- **BE-1 (remover as policies de listagem "Public read contract pdfs" / "Public read access for payment proofs"): GO.**
  Independe deste PR: a rota `/object/public` não consulta essas policies e nenhum código lista objetos com a chave
  pública. Ação no Dashboard (o papel SQL disponível não é dono de `storage.objects`).
- **BE-2 (buckets privados): NO-GO até o deploy deste PR + 1 checagem manual.** Depois do deploy: abrir 1 PDF pelo portal,
  1 pelo `/contrato/<token>`, 1 comprovante pelo portal e 1 pelo admin → todos devem abrir (redirect 302 para URL assinada).
  Com isso, **GO**. Efeito aceito: as 4 mensagens antigas ao admin com URL direta deixam de abrir.

## B. Credenciais e segredos (sem valores)

| Item | Estado | Evidência |
|---|---|---|
| BE-3 Google OAuth | **CONFIGURADO, NÃO ROTACIONADO** | Caminho de exposição fechado: `google_oauth_credentials` com RLS e sem SELECT para `anon`/`authenticated`; só `lib/contracts/googleCredentials.js` (service role) lê; nenhuma rota devolve token. Os 2 tokens ativos são de 2026-04-08/09 (anteriores ao fechamento) → rotação ainda devida. |
| BE-6 Senha vazada | **AUSENTE** | Advisor `auth_leaked_password_protection`: desativado. |
| BE-8 Redirect URLs | **NÃO VERIFICÁVEL** | Sem acesso à configuração de Auth por esta sessão. |
| BE-9 `CRON_SECRET` | **AUSENTE (nos dois lados)** | Run do cron de 2026-10-14 23:44 UTC (já com #735): `CRON_SECRET:` vazio no GitHub e a chamada sem segredo retornou 200 → o Worker também não tem `CRON_SECRET`. Hoje qualquer pessoa pode disparar o cron (a deduplicação evita reenvio do mesmo lembrete). |
| BE-10 `INTERNAL_API_KEY` | **NÃO VERIFICÁVEL / não exigido** | Nenhum consumidor no código; sem a chave, as rotas internas aceitam só admin do workspace. |
| Asaas webhook secret | **AUSENTE (inferido)** | `billing_events` = 0 (nenhum webhook recebido); sem `ASAAS_WEBHOOK_SECRET` o webhook responde 503 (falha fechada). |

Nenhuma credencial foi rotacionada. Ordem segura:
1. BE-9 — gerar um valor forte e gravar **ao mesmo tempo** `CRON_SECRET` no Worker e `HARMONICS_CRON_SECRET` no GitHub
   (se só o Worker tiver, o cron do GitHub passa a receber 401). Conferir o próximo run (verde e com `CRON_SECRET: ***`).
2. BE-6 — ativar no Dashboard (afeta só novas senhas).
3. BE-3 — em horário sem geração de contrato: revogar o app em myaccount.google.com/permissions, reconectar em
   Configurações → Integrações (`/api/google/oauth/start`), gerar 1 contrato de teste. Os 2 registros antigos ficam
   inativos/revogados pelo próprio fluxo.

## C. Asaas — estado real

| Ponto | Estado |
|---|---|
| Assinatura (`/api/billing/subscribe`) | Pronto: admin do workspace, plano público pago, reaproveita checkout pendente (24h), cliente Asaas por workspace, `externalReference = workspace_id`; o plano só muda após pagamento. |
| Criação de cobrança | Feita pelo Asaas a partir da assinatura (`billingType: UNDEFINED`, `nextDueDate` hoje); `invoiceUrl` devolvida. |
| Webhook (`/api/webhooks/asaas`) | Pronto: token `asaas-access-token` comparado em tempo constante, 503 sem segredo, 401 token errado. |
| Idempotência | `UNIQUE(provider, event_id)` em `billing_events`; reprocessa só `received/failed`; eventos fora de ordem ignorados. |
| Pago | `PAYMENT_CONFIRMED/RECEIVED` → `active`, período = vencimento + 1 mês, promove o checkout pendente. |
| Vencido | `PAYMENT_OVERDUE` (e estorno/chargeback) → `past_due`; carência de 7 dias após `current_period_end`, depois limites do Free. |
| Cancelamento | `/api/billing/cancel` e `SUBSCRIPTION_DELETED/INACTIVATED` → `cancel_at_period_end`; acesso até o fim do período. |
| Falha de pagamento (cartão recusado) | Sem mudança imediata; vira `past_due` quando o Asaas manda `PAYMENT_OVERDUE`. |
| Mudança de plano | Atualiza o valor da assinatura no Asaas e o `plan_id` **na hora** (upgrade vale antes do pagamento da diferença) — decisão de produto. |
| Limites backend | Eventos/mês e membros → 402; WhatsApp por mês e recurso `whatsapp` → 402. **Só bloqueiam com `ENFORCE_WORKSPACE_PLANS=true`** (valor em produção não verificável daqui). |
| Dados | 0 eventos de billing; 4 workspaces: Harmonics e 1 outro `internal` (ilimitados), 2 no Free. |

Para conectar o sandbox (nada de código): Worker de staging com `ASAAS_ENV=sandbox`, `ASAAS_API_KEY` (sandbox),
`ASAAS_WEBHOOK_SECRET`; no painel sandbox → Webhooks: URL `https://<staging>/api/webhooks/asaas`, token = o segredo,
eventos de Cobrança e Assinatura. **Não configurar no Worker de produção antes do Cliente Zero.**

Decisões de produto abertas: plano Free sem WhatsApp/automação (`can_use_whatsapp=false`, `can_use_automation=false`)
— com `ENFORCE_WORKSPACE_PLANS=true` um cliente Free não envia WhatsApp; Enterprise (R$ 497) e White Label (R$ 997)
estão públicos; upgrade imediato antes do pagamento.

## D. Staging + Cliente Zero

### Exigências (dependem do responsável)
1. **Banco isolado:** projeto Supabase novo `harmonics-staging` (recomendado: sem custo de branch e sem risco de tocar
   produção) ou Branch do projeto atual (tem custo; só 7 migrations estão registradas → o branch nasce incompleto).
   Schema: `supabase db dump --schema public,storage` de produção (só DDL) aplicado no staging; copiar `workspace_plans`.
   Buckets `contract-pdfs` e `payment-proofs` criados **privados**.
2. **Worker separado** `harmonics-app-staging` (a "Branch Preview" do Cloudflare usa os segredos e o banco de **produção**,
   não serve como staging). O script `deploy:preview` usa `--env preview`, mas `wrangler.toml` não tem `[env.preview]`:
   criar a seção com `name = "harmonics-app-staging"` e os segredos próprios (tabela em `STAGING.md` §2).
3. **Auth do staging:** Site URL = URL do Worker de staging; Redirect URLs `/auth/reset-password` e `/login`; SMTP
   (Resend de teste) para os e-mails de confirmação/recuperação.
4. **Asaas sandbox:** conta sandbox + chave + webhook (seção C).
5. **WhatsApp:** canal de teste próprio (não usar o número da Harmonics) ou deixar vazio.
6. `ENFORCE_WORKSPACE_PLANS=true` e `CRON_SECRET` próprio no staging.

### Checklist do Cliente Zero (e-mail novo, sem nenhum dado da Harmonics)
- [ ] 1 Staging no ar (URL própria, banco próprio — conferir que a URL do Supabase no HTML ≠ produção)
- [ ] 2 Banco isolado com schema de produção e sem dados pessoais
- [ ] 3 Asaas sandbox conectado (webhook de teste retorna 200 e grava em `billing_events`)
- [ ] 4 Usuário novo: `/signup`
- [ ] 5 Confirmação de e-mail recebida e link funcionando
- [ ] 6 Recuperação de senha → `/auth/reset-password` → nova senha → login
- [ ] 7 Onboarding (5 campos) → "Seu espaço está pronto" → checklist
- [ ] 8 Workspace criado uma única vez (clique duplo / voltar não duplica)
- [ ] 9 Contatos: cliente e músico
- [ ] 10 Evento criado
- [ ] 11 Escala: convite ao músico, aceite em `/membro`
- [ ] 12 Contrato: pré-contrato → link público → assinatura → PDF
- [ ] 13 Arquivos: PDF pelo portal/`/contrato`/admin e comprovante pelo portal/admin abrem com bucket **privado**
- [ ] 14 Automações: regra + template + canal de teste; envio registrado em `automation_logs`
- [ ] 15 Assinatura: Free → Starter (CPF de teste) → pagar no sandbox → plano ativo; Starter → Pro
- [ ] 16 Limites: no Free, 11º evento do mês → 402 `PLAN_LIMIT_REACHED`; membro acima de `max_members` (2) → 402
- [ ] 17 Cancelamento: acesso até o fim do período; vencido → carência → limites do Free
- [ ] 18 Isolamento A×B: workspace B com outro usuário; com a sessão de A chamar as APIs com IDs de B
      (`/api/events/<id>`, `/api/contracts/<id>/signed-url`, `/api/files/payments/<id>/download`,
      `/api/automation/rules/<id>`, `/api/public/files/payment-proof/<token-de-A>?p=<pagamento-de-B>`) → 403/404;
      a Harmonics (produção) nunca aparece, e nada do Cliente Zero aparece em produção (bancos diferentes).
