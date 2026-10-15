# Harmonics App — Relatório da finalização corretiva SaaS (2026-10-14)

Branch: `claude/magical-franklin-l6oe6q` (49 commits sobre `main`). **Nada do código desta branch está em produção até o deploy manual (BE-4).**
As migrations de banco abaixo **já estão aplicadas** em produção (todas aditivas, com rollback).

## 1. Resumo executivo
- Segurança: 24 achados ERROR do advisor → 0. Rotas sem autenticação fechadas; escalonamento de `profiles.role` bloqueado no banco.
- Multi-tenancy: autorização sessão → membership → workspace centralizada (`lib/api/route-guards.js`); preços, custos, templates de escala e WhatsApp por workspace; RLS sem bypass por admin global. Teste A×B negou leitura, alteração e inserção cruzadas.
- Prebuild: 22 patches incorporados ao código; build não altera mais arquivos (`git diff` limpo).
- Jornada: signup idempotente, recuperação de senha corrigida, onboarding único (1 tela + checklist).
- Billing Asaas: schema reconciliado, webhook idempotente com ordem de eventos, limites no backend (402), tela de assinatura.
- Performance, PWA, estados vazios, mobile e observabilidade entregues.
- Não executado por depender de terceiros: staging, Cliente Zero, regressão de UI com login real, buckets privados, rotação de credenciais.

## 2. Status por fase
| Fase | Status |
|---|---|
| 0 Segurança | Concluída no código e no banco; storage parcial (BE-1/BE-2), rotação (BE-3) |
| 1 Multi-tenancy | Concluída (decisão pendente D-1) |
| 2 Prebuild | Concluída |
| 3 Onboarding | Concluída |
| 4 Signup/auth | Concluída; ajuste de Redirect URLs no Supabase (BE-8) e proteção de senha vazada (BE-6) |
| 5 Billing | Código concluído; configuração Asaas (BE-7) |
| 6 Performance | Concluída |
| 7 Estados vazios | Concluída |
| 8 UX/mobile | Parcial: inputs 16px, smoke 360/768/1280 24/24; revisão fina de tabelas/modais pendente |
| 9 PWA | Concluída |
| 10 Observabilidade | Concluída (log JSON por request + `x-request-id`) |
| 11 Staging | Runbook pronto (`STAGING.md`); criação bloqueada (BE-5) |
| 12 Cliente Zero | Bloqueada (BE-5) — roteiro pronto |
| 13 Regressão Harmonics | Banco: sem diferenças; UI: checklist pós-deploy (`REGRESSAO_HARMONICS.md`) |
| 14 Legado | Só removido o que foi provado sem uso (scripts prebuild, `GoogleMapsScriptClient`, cliente Asaas antigo); resto listado em Pendências |

## 3. Segurança
- Trigger `guard_profile_privilege_columns`: usuário não altera o próprio `role` (42501).
- RLS + revoke em tabelas server-only (`google_oauth_credentials`, `workspace_settings`, `users`, `roles`, `suggestion_*`, backups etc.); catálogos legíveis por autenticados e graváveis só por admin da plataforma.
- `EXECUTE` de funções SECURITY DEFINER revogado de `anon`.
- APIs: automação, envio WhatsApp, contratos (archive/pdf/html-to-pdf), OAuth force-reauth, test-automation, convite de escala e `debug/*` agora exigem autenticação/admin do workspace ou `INTERNAL_API_KEY`; `channels/ping` com allowlist de host (anti-SSRF); `onboarding/progress` não usa mais host vindo do cliente.
- Storage: endpoint `/api/public/files/contract/<token>` (URL assinada de 10 min; Drive e URLs externas redirecionam para o link original) pronto, **ainda sem consumidores** — revisão pré-merge manteve portal, verify e automações no `pdf_url` original. Migração dos consumidores + buckets privados juntos (BE-2).

## 4. Multi-tenancy
- Guards centrais: `guardWorkspaceMember/Admin`, `guardPlatformAdmin`, `assertRowInWorkspace` (404 para ID de outro tenant).
- Rotas que usavam admin global de perfil agora filtram por workspace e falham fechado.
- `pricing_settings`, `finance_cost_defaults`, `scale_templates` ganharam `workspace_id` (backfill para a Harmonics).
- `current_user_can_access_event` usa admin **do workspace do evento**.
- WhatsApp: cada workspace usa só o seu canal; a Harmonics (dona das variáveis `WHATSAPP_*`) mantém o caminho anterior.
- Service role continua só no servidor e sempre com filtro de workspace explícito.

## 5. Onboarding
Um único fluxo: `/signup` → `/onboarding` (5 campos) → "Seu espaço está pronto." → dashboard com checklist baseado em fatos (tem músico, tem evento…). Sem reset de `completed_at`; "Mostrar no painel novamente" disponível. Signup interrompido retoma em `/workspace/new` com dados pré-preenchidos.

## 6. Billing
- Catálogo único `workspace_plans` (front e backend). Estados: active, trialing, past_due (carência 7 dias), canceled, cancelamento no fim do período.
- Webhook `/api/webhooks/asaas`: token `asaas-access-token`, idempotência por `UNIQUE(provider, event_id)` em `billing_events`, eventos fora de ordem ignorados, checkout pendente não troca o plano antes do pagamento.
- Limites no backend: eventos/mês e equipe → HTTP 402 **somente com `ENFORCE_WORKSPACE_PLANS=true`** (mesma semântica já usada em produção); sem a variável o limite é só registrado (`[PLAN_LIMIT][SOFT]`). Workspace `internal` (Harmonics) ilimitado. Em erro de leitura de plano, libera (fail-open).
- Tela `/settings/billing`; `/assinar` e `/assinatura` redirecionam.

## 7. Performance antes/depois
| Item | Antes | Depois |
|---|---|---|
| Resolução de usuário/workspace por request | 2 chamadas Auth + 6 queries sequenciais | 1 Auth + 4 queries em 3 ondas paralelas |
| Google Maps | script carregado em todas as páginas | mantido como estava (revisão pré-merge: a chave é lida no servidor como hoje) |
| Hotfixes de DOM | rodavam em todas as rotas | só nas rotas que os usam |
| Dashboard | queries em série | em paralelo; cache vinculado ao dono |
| Carregamento | tela "Verificando sessão" | skeleton do app + `loading.js`/`error.js` |
Medição de LCP/TTFB em produção depende do deploy (BE-4).

## 8. Prebuild
22 scripts incorporados (1 commit cada, idempotência verificada), script `prebuild` removido, equivalência comparada com `main`+prebuild. Corrigido token de convite que virava constante de build. Dois scripts que nunca eram aplicados documentados em `scripts/README-unapplied-patches.md`. Build → `git diff` vazio.

## 9. Banco e migrations (aplicadas em produção; rollback em `supabase/rollbacks/`)
| Migration | Natureza |
|---|---|
| 20261014090000 phase0a profile privilege guard | trigger novo |
| 20261014090100 phase0b RLS server-only tables | RLS/grants/policies |
| 20261014090200 phase0c definer functions execute | grants |
| 20261014100000 phase1 workspace scoped settings | colunas nullable + backfill + índices |
| 20261014110000 phase1 event access without global admin | função |
| 20261014120000 phase4 workspace bootstrap idempotency | índice único parcial |
| 20261014130000 phase3 onboarding flow state | coluna com default |
| 20261014140000 phase5 billing reconciliation | colunas + tabela `billing_events` |
Nenhum DROP/TRUNCATE/DELETE, nenhum NOT NULL em coluna existente. Testes: `supabase/tests/phase0_security_assertions.sql`, `tenant_isolation_a_vs_b.sql` (rodam em transação revertida).

## 10. Commits
Ver `git log origin/main..claude/magical-franklin-l6oe6q`. Principais:
`2145907` segurança banco · `d457b74` segurança APIs · `f378e72` WhatsApp por workspace · `c013fe0` configs por workspace · `5b76778` perf auth · `dc13036` RLS/A×B · `261a5d2…a6c34dd` 22 patches incorporados · `a5865b3` token de convite · `a516212` templates de escala · `9f02681` remoção prebuild · `8b6a265` recuperação de senha · `bf3e626` signup idempotente · `02c86e2` retomada de signup · `3cf4fa3` onboarding · `f2480be` billing backend · `2999be7` billing UI · `5e1d994` performance · `86f6a03` PWA · `ffacb40` estados vazios · `f59d806` mobile + smoke · `fd45378` observabilidade · `69582d8` PDFs por URL assinada · `106cdb6` runbooks.

## 11. Cliente Zero
**Não executado.** BLOQUEIO EXTERNO BE-5 (staging + Asaas sandbox). Roteiro completo em `docs/saas/STAGING.md` §3.

## 12. Teste A×B
Executado no banco de produção em transação revertida (`banda-ok` × `banda-teste`, papel `authenticated`): SELECT, UPDATE e INSERT em eventos, contatos, pagamentos, contratos, automações → negados; única linha visível é o contato do próprio usuário (esperado). Nas APIs, `assertRowInWorkspace` retorna 404. Teste de API ponta a ponta com dois logins: no staging.

## 13. Regressão Harmonics
Banco: contagens visíveis para o admin da Harmonics e para um músico idênticas antes/depois das migrations. Código: 96/96 testes, build ok, smoke 24/24. UI com login real: checklist pós-deploy em `REGRESSAO_HARMONICS.md`.

## 14. Bloqueios externos (detalhe em `BLOQUEIOS_EXTERNOS.md`)
BE-1 policies de listagem de storage (owner `supabase_storage_admin`) · BE-2 tornar buckets privados após migrar consumidores · BE-3 rotacionar token Google · BE-4 deploy manual · BE-5 staging/sandbox · BE-6 leaked password protection · BE-7 conta/webhook Asaas · BE-8 Redirect URLs Auth · BE-9 `CRON_SECRET` · BE-10 `INTERNAL_API_KEY`.

## 15. Pendências
- Migrar consumidores restantes de URL pública de arquivo (página de contrato, `ClienteHome`, `ContractPreviewMobileFix`, telas admin, comprovantes `proof_file_url`) e só então BE-2.
- Decisão D-1: liberar `finance_cost_defaults` via API por workspace.
- Revisão fina mobile de tabelas e modais.
- Legado (remover só após prova de não uso): gerações antigas de onboarding, `check-workspace-plan-limit.js`, `EscalasListaTab`, `GlobalPlayerHost`, `PrecontractGuideStable`, `TemplateCreationGuide`, `layout/AppShell`, `Sidebar`, `Header`, dependência `@supabase/auth-helpers-nextjs`.
- Pré-existentes registrados: músicos leem pagamentos/contratos dos eventos em que tocam; `getDefaultWorkspaceSettings` seleciona colunas inexistentes (cai no env); 4 testes OAuth legados falhando (isolados em `test:oauth-legacy`).

## 16. Prontidão SaaS
**≈ 75%** (código ≈ 90%; operação ≈ 55%). Para abrir a novos clientes faltam: deploy + regressão (BE-4), staging + Cliente Zero (BE-5), Asaas (BE-7), Auth URLs (BE-8), segredos (BE-9/10) e fechamento dos buckets (BE-2). Nenhum desses exige nova arquitetura.
