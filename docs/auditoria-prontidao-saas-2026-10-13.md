# Auditoria de Prontidão SaaS — Harmonics App

**Data:** 2026-10-13
**Escopo:** código do repositório (`main` @ `16a5aa2`), banco Supabase `harmonics-saas-dev` (inspeção somente leitura), build de produção local.
**Nenhuma alteração foi feita em produção, em dados ou em código de aplicação.**

> **Premissa importante.** O único projeto Supabase acessível que contém as tabelas do Harmonics é `harmonics-saas-dev` (23 usuários, 4 workspaces, 83 eventos reais da banda, migrations de hoje aplicadas). Apesar do nome "dev", tudo indica que **é o banco de produção** (o código tem fallbacks exatamente para as colunas que faltam nele). Todas as conclusões sobre banco abaixo referem-se a ele. Se existir outro banco de produção, os itens marcados **[DB]** precisam ser revalidados lá.

---

## A. Resumo executivo

**Hoje o Harmonics está aproximadamente 35% pronto para ser comercializado como SaaS.**

- **Como produto operacional da banda Harmonics, ele é maduro** (~85%): eventos, pré-contratos, contratos com assinatura e PDF, escalas, portal do cliente, portal do membro, repertório, financeiro operacional e automações funcionam e são usados todo dia.
- **A camada SaaS ficou no meio do caminho**, e em pontos críticos ela *parece* pronta mas não funciona:
  1. **Segurança/isolamento está vermelho.** Qualquer pessoa na internet, só com a chave pública (que está no JavaScript do site), consegue ler/alterar/apagar 23 tabelas — incluindo o **refresh token do Google** usado para gerar contratos e as **configurações de todos os workspaces**. Qualquer usuário logado consegue se promover a "admin" global editando o próprio `profiles.role`, e a partir daí ler eventos/contratos/pagamentos de **todos** os workspaces. Há rotas de API que alteram dados **sem nenhuma autenticação**. Os PDFs de contratos assinados e comprovantes de pagamento estão em buckets **públicos**.
  2. **Billing/Asaas não funciona em nenhuma etapa.** A migration de billing nunca foi aplicada no banco (colunas `asaas_*` e tabela `billing_events` não existem), a rota de assinatura sempre falha (consulta coluna inexistente `is_active` em `workspace_plans`), a tela `/assinar` oferece planos (`plus`, `premium`) que não existem no banco, e o webhook não ativa assinatura ao receber pagamento.
  3. **Limites de plano não existem no backend.** Só há verificação (em modo "soft", desligada por padrão) para WhatsApp. Eventos, membros, contratos: sem limite.
  4. **Onboarding não persiste.** O fluxo de 20 etapas grava progresso numa coluna (`flow_state`) que não existe no banco; conclusão, skip e marcas de "visto" se perdem. Há duas fontes de verdade divergentes (comprovado no banco).
  5. **Vários recursos "por workspace" ainda são globais** (preços, custos padrão, templates de escala, canal WhatsApp de fallback, alertas de admin) — um cliente novo usaria/alteraria configurações da Harmonics.

Por isso: o produto é real e valioso, mas **não pode receber clientes externos** até a Fase 0 (segurança) e as Fases 1–2 (jornada e billing) abaixo estarem concluídas.

---

## B. Bloqueadores de lançamento

Somente o que realmente impede vender:

| # | Bloqueador | Por quê |
|---|---|---|
| B1 | **23 tabelas sem RLS com GRANT total para `anon`** [DB] | Vazamento/alteração/exclusão por qualquer pessoa: `google_oauth_credentials`, `workspace_settings`, `workspace_plans`, `pricing_settings`, `client_reviews`, `users`, `scale_templates`… |
| B2 | **Escalonamento de privilégio via `profiles.role`** [DB] | `authenticated` tem UPDATE na coluna `role` + policy `profiles_update_own`. Usuário vira `admin` → `current_user_is_admin()` → lê todos os tenants via RLS e passa nos guards globais da API. |
| B3 | **Rotas de API de escrita sem autenticação** | `PATCH /api/automation/rules/[id]`, `PATCH /api/automation/templates/[id]`, `PATCH/DELETE /api/automation/channels/[id]`, `POST /api/contracts/archive`, `POST /api/contracts/internal/pdf` (sobrescreve PDF de contrato com HTML arbitrário), `POST /api/whatsapp/send-invite`, `POST /api/google/oauth/force-reauth`, `POST /api/test-automation`, `POST /api/automation/channels/ping` (SSRF). |
| B4 | **Buckets públicos** `contract-pdfs` (119 arquivos) e `payment-proofs` (27) [DB] | Contratos assinados (com CPF) e comprovantes acessíveis por URL e listáveis via API pública de storage. LGPD. |
| B5 | **Billing inexistente na prática** | Ver seção F. Não há como cobrar. |
| B6 | **Limites de plano só no front (ou nem isso)** | Plano Free ilimitado na prática. |
| B7 | **Configurações globais compartilhadas entre tenants** | `pricing_settings`, `finance_cost_defaults`, `scale_templates` sem `workspace_id`; fallback de canal WhatsApp e telefone de alerta "do primeiro workspace ativo". Cliente novo usa e pode sobrescrever dados da Harmonics. |
| B8 | **APIs de gestão protegidas por "admin global"** | `admin/contract-templates/[id]`, `admin/event-types/[id]`, `automation/rules|templates|channels|logs`, `repertoire/delete`, `events/[id]/external-contract`, `admin/usuarios/*` exigem `profiles.role='admin'` (só a conta Harmonics). **Um cliente SaaS recebe 403** ao editar template de contrato, tipo de evento, automações. E, inversamente, essas rotas não filtram workspace. |
| B9 | **Onboarding sem persistência** | Progresso, conclusão e skip não ficam salvos (coluna inexistente). |
| B10 | **Recuperação de senha quebrada no fluxo principal** | Login e Configurações enviam o link para `/login?reset=done`, que não exibe formulário de nova senha. A página correta `/auth/reset-password` só é usada por uma rota que a UI não chama. |

---

## C. Matriz de prontidão

| Área | Status | Problema principal | Impacto | Correção necessária |
|---|---|---|---|---|
| Autenticação | 🟡 | Sessão via `@supabase/ssr` ok; 2 chamadas `auth.getUser` por request de API; reset de senha quebrado; sem rate limit real | Lentidão, usuário travado sem conseguir trocar senha | Unificar resolução de usuário; corrigir redirect de reset; rate limit em KV |
| Signup | 🟡 | Funciona com/sem confirmação de e-mail, mas descarta dados do cadastro se precisar confirmar e-mail (login apaga `harmonics_pending_signup_bootstrap`); `profiles` nunca recebe nome (payload com `is_admin` falha) | Usuário redigita dados; perfil sem nome | Retomar bootstrap pendente após login; corrigir payload de perfil |
| Workspace | 🟡 | Criação ok via `bootstrapWorkspaceForUser`; `/api/workspace/create` **não é idempotente** (duplo clique = 2 workspaces); sem troca de workspace; seleção "primeiro membership ativo" | Workspaces duplicados; usuário com 2+ workspaces não escolhe | Idempotência + seletor de workspace |
| Multi-tenant | 🔴 | B1, B2, B3, B4, B7, B8; dashboard e financeiro consultam direto via RLS sem `workspace_id` → conta admin vê dados de todos os tenants misturados | Vazamento entre clientes | Fase 0 inteira |
| Onboarding | 🔴 | 3+ gerações coexistindo; persistência quebrada; 20 etapas com dados "fake"; restart aponta para rotas inexistentes (`/automacao`, `/contrato/[token]`) | Primeira experiência ruim e instável | Simplificar (seção E) |
| Dashboard | 🟡 | Rico para conta com dados; 3 ondas sequenciais de queries client-side; cache em memória não chaveado por workspace; sem empty state dedicado (só com `?onboarding=fresh-workspace`) | Lento; conta nova vê zeros | Server-side + resumo agregado + estado "conta nova" |
| Clientes (contatos) | 🟡 | API com workspace ok; empty state só "Nenhum contato encontrado" sem CTA | UX de conta nova | Empty state com ação |
| Eventos | 🟡 | API ok e filtrada; página de 2.649 linhas client-side; preços lidos de `pricing_settings` **global** (slug `default`) e salvos nela | Cliente altera preço da Harmonics | Preços por workspace |
| Músicos/Escalas | 🟡 | `scale_templates` global; `/templates-escala` filtra por `workspace_id` inexistente → **provável erro ao carregar** | Página quebrada / dados compartilhados | Migrar `scale_templates` para workspace |
| Contratos | 🔴 | Rotas sem auth (archive, internal/pdf), bucket público, edição de template exige admin global, geração depende de **uma** credencial Google global | Falsificação de contrato; cliente SaaS não consegue configurar | Auth + storage privado + templates por workspace |
| Agenda | 🟡 | Agenda do membro por e-mail cruzando workspaces via `current_user_contact_id()` (LIMIT 1 sem workspace) | Membro em 2 bandas vê só uma | Contato por workspace |
| Financeiro | 🟡 | Novo financeiro operacional (op_finance_*) está bem feito (RLS fechado, ledger imutável); página `/pagamentos` consulta via client sem filtro e usa `finance_cost_defaults` global | Mistura de tenants para admin; custos globais | Mover para API + defaults por workspace |
| Billing | 🔴 | Ver seção F | Não cobra | Reconstruir ciclo |
| Asaas | 🔴 | Migration não aplicada; webhook sem idempotência real nem ordenação; segredo opcional | Inutilizável | Ver seção F |
| Planos/limites | 🔴 | Só WhatsApp (soft, desligado). `usage_events` não existe. Planos da UI ≠ planos do banco | Free ilimitado | Enforcement no backend |
| Mobile | 🟡 | Navegação inferior e drawers existem; inputs 16px (sem zoom); tabelas em pagamentos/regras; páginas gigantes client-side pesadas em 4G | Lento em celular | Medir em device + reduzir JS |
| Performance | 🔴 | ~250–300 KB gzip de JS em **toda** rota (inclusive login); Google Maps carregado em todas as páginas; `(admin)/layout.js` 100% client com tela "Verificando sessão..."; 6–8 round-trips de auth/workspace por chamada de API | Sensação de "site", não de app | Seção H |
| PWA | 🔴 | `site.webmanifest` existe mas **não está linkado**; sem `start_url`, sem service worker, sem `theme-color`/viewport, `lang="en"` | Não instalável | Fase 4 |
| Segurança | 🔴 | B1–B4, rotas `/api/debug/*` em produção, `GET /api/google/maps-key` expõe chave, cron aberto se `CRON_SECRET` ausente, leaked-password protection off | Ver seção G | Fase 0 |
| Observabilidade | 🔴 | 965 `console.*`, sem Sentry/APM, sem correlation id, `billing_events`/`usage_events`/`file_access_logs` não existem | Impossível responder "por que o cliente X falhou" | Fase 0/5 |

---

## D. Arquitetura atual

### Mapa conceitual (como foi desenhado)

```
auth.users ──trigger handle_new_user──▶ profiles (role='member')
     │
     └──▶ workspace_members (role: owner/admin/…, status) ──▶ workspaces (key, slug, status, plan_key)
                                                               │
                                     ┌─────────────────────────┼──────────────────────────────┐
                                     ▼                         ▼                              ▼
                          workspace_settings        workspace_subscriptions ──▶ workspace_plans   dados: events, contacts,
                          (1:1, RLS OFF)            (trigger cria FREE)          (limites/flags)   precontracts, contracts,
                                                                                                    payments, quotes, op_finance_*…
```

### Como realmente funciona (exceções)

1. **Duas autoridades de permissão concorrentes**
   - `workspace_members.role` (correto, multi-tenant) — usado por `requireWorkspaceAccess` e `current_user_is_workspace_admin()`.
   - `profiles.role` global (`admin`/`administrador`/`owner`) — legado single-tenant, usado por `current_user_is_admin()`, `requireAdmin`, `requireAdminServer`, `ProtectedRoute`, e como **bypass** em `requireWorkspaceAccess` (`isLegacyProfileAdmin`) e em `getCurrentWorkspace` (cai no workspace `default`).
   - Hoje: 2 perfis `admin` (conta Harmonics), 20 `member`. Coluna `profiles.is_admin` **não existe**, mas o código a lê/escreve em vários lugares.
2. **Resolução do workspace ativo** (`lib/workspaces/get-current-workspace.js`): header `x-workspace-id` / cookie `workspace_id` / query `?workspace_id` → valida membership → senão primeiro membership ativo → senão `profiles.current_workspace_id` (coluna inexistente) → senão, se admin legado, workspace `default` → senão "primeiro workspace ativo". Não há UI de troca de workspace.
3. **Dois padrões de acesso a dados coexistem**
   - **API + service role + `requireWorkspaceAccess` + `.eq('workspace_id')`** (eventos, contatos, pagamentos via API, contratos, quotes, op-finance) — correto.
   - **Client Supabase direto + RLS, sem filtro de workspace** (dashboard, `/pagamentos`, partes de `/eventos`, `/templates-escala`, `/admin/painel-membros`, `AuthContext`). Para a conta Harmonics (`profiles.role=admin`), a RLS libera **todos os workspaces**.
4. **Tabelas ainda globais (sem `workspace_id`)**: `pricing_settings`, `finance_cost_defaults`, `scale_templates`, `scale_template_items`, `client_reviews`, `suggestion_*` (catálogo — global por desenho, ok), `users`, `roles`, `assignments`, `event_role_slots` (legado).
5. **Tabelas filhas sem `workspace_id`** (isoladas via join com `events`): `event_musicians`, `invites`, `repertoire_config`, `contract_adjustment_requests`. Funciona via RLS/API, mas dificulta índices e auditoria.
6. **Automação/WhatsApp**: `getDefaultWorkspaceSettings()` = "primeiro `workspace_settings` ativo" (sem ORDER BY). Usado como fallback em `send-whatsapp-message.js:183`, `send-admin-alert.js:63`, `resolve-recipient.js:24`, `automation/channels/[id]`, `test-channel`, `test-automation`. Com mais de um workspace, o fallback é **não determinístico** e pode usar o canal/telefone de outro tenant.
7. **Hardcode da Harmonics**: `HARMONICS_PRIMARY_WORKSPACE_ID` em `app/api/onboarding/flow-status/route.js`; chave `default` em `get-current-workspace.js` e `workspace/delete`.
8. **Deriva de schema (repo × banco)** [DB]: das 46 migrations do repo, só 3 estão registradas em `supabase_migrations`. Não aplicadas no banco: `billing_core_v1_asaas`, `onboarding_dynamic_flow` (`flow_state`, `is_demo`, `source`, `metadata`), `scale_templates_onboarding_workspace`, `contacts_onboarding_demo_metadata`, `contracts_validation_token`, `add_invite_send_lock_fields`, `contract_template_blocks/variables`, e os SQL de `supabase/sql/` (`usage_events`, `file_access_logs`, `storage_asset_migrations`…). O código sobrevive com **12 cópias** de `isMissingColumnError` e cascatas de "tenta com coluna, tenta sem".
9. **Código no git ≠ código em produção**: `npm run prebuild` executa **22 scripts `scripts/patch-*.mjs` (~1.800 linhas)** que reescrevem arquivos-fonte (`app/membro/page.js`, `lib/automation/execute-automation-event.js`, `EventoEscalaTab.js`, etc.) antes de cada build.

---

## E. Onboarding

### Fluxo atual real

```
/signup ──(sem confirmação de e-mail)──▶ POST /api/public/signup/bootstrap ──▶ /onboarding
   │                                                                             │
   └─(com confirmação)─▶ /login?signup=check-email                               ▼
          e-mail ▶ /login?signup=confirmed ▶ login (apaga dados pendentes)   form: nome público/WhatsApp/cor
          ▶ /api/workspace/me 403 ▶ /workspace/new (redigita tudo)            POST /api/onboarding/complete
          ▶ POST /api/workspace/create ▶ /dashboard?onboarding=fresh-workspace  ▶ /eventos?tour=first-event
```

Depois disso, o **fluxo dinâmico de 20 etapas** (`lib/onboarding/onboarding-flow.js`) guia por: template de contrato → tipo de evento → pré-contrato *fake* → abrir contrato público → assinar como cliente → PDF → painel do cliente → repertório do cliente → membros *fake* → template de formação → escala → painel do membro → automações → financeiro → repertório admin → dashboard demo → apagar evento demo → concluído.

### Gerações sobrepostas encontradas

| Geração | Arquivos | Onde salva estado |
|---|---|---|
| 1. Checklist booleano | `workspace_onboarding_progress` (8 booleanos), `restartOnboardingStep.js`, `completeOnboardingStep.js` (aliases legados) | Banco (booleanos) |
| 2. Onboarding de formulário | `app/onboarding/page.jsx`, `/api/onboarding/complete` | `workspace_settings.settings.onboarding.completed` (JSON) |
| 3. Fluxo dinâmico/demo | `onboarding-flow.js`, `/api/onboarding/flow-status`, `OnboardingFlowProvider`, `OnboardingPrerequisiteGate`, guias `*Stable*`, `fake-members`, `formation-template` | `workspace_onboarding_progress.flow_state` (**coluna não existe**) |
| 4. Tours/overlays | `tourRegistry`, `operationalTourRegistry`, `OnboardingTourOverlay`, `SectionGuidedOnboarding`, `FreshWorkspaceStartGuide`, `DashboardOnboardingBanner` | `workspace_tour_progress` (0 linhas), `localStorage` (`harmonics:onboarding-tour:v1`, `harmonics:section-guide:*`, `harmonics:precontract-guide:v9`, …), `OnboardingSessionContext` (memória), parâmetros de URL, **header `Referer`** |
| Código morto | `PrecontractGuideStable.js` (substituído por V2), `TemplateCreationGuide.js` (substituído por Stable) | — |

### Problemas

- **Fonte de verdade**: não há uma. Evidência no banco: `banda-teste` tem `settings.onboarding.completed=true` e `workspace_onboarding_progress.completed_at = null`.
- **Persistência**: todo `PATCH /api/onboarding/flow-status` tenta gravar `flow_state` → erro de coluna → cai no retorno "em memória". Marcas como `hasAutomationsViewed`, `client_panel_tour_completed`, `onboarding_completed`, `skipped` **nunca persistem** → o fluxo trava na etapa "Repertório do cliente" e reinicia a cada visita.
- **Evento demo**: buscado por `is_demo`/`source`/`metadata` (colunas inexistentes) → nunca encontrado → etapas de escala/limpeza não avançam.
- **Idempotência**: conclusão é idempotente no JSON; o resto não é aplicável porque não persiste.
- **Skip/restart**: skip não persiste; restart aponta para `/automacao` (rota real é `/automacoes`) e para o literal `/contrato/[token]`.
- **Interferência no usuário antigo**: protegido por `isPrimaryHarmonicsWorkspace` (ID/chave hardcoded) — frágil.
- **Excesso**: obriga o usuário a simular um cliente assinando contrato fake e criar membros fake antes de usar o produto.

### Fluxo recomendado

```
/signup  (nome, e-mail, senha, nome da banda/negócio)                       1 tela
   ▼
[confirmação de e-mail, se ativa] → link volta para /auth/callback → sessão
   ▼
/onboarding  (telefone/WhatsApp, cidade, tipo de atuação: banda/orquestra/DJ/ministério/outro)   1 tela, pulável
   ▼  — bootstrap idempotente (workspace + membership owner + settings + subscription FREE + defaults do workspace: preços, custos, 1 template de contrato, 2 tipos de evento)
"Seu espaço está pronto" → /dashboard
   ▼
Dashboard de conta nova = checklist contextual (não bloqueante), 5 itens, cada um detectado por FATO no banco:
   [ ] Revisar seu template de contrato        (contract_templates do workspace editado)
   [ ] Cadastrar seus músicos                  (contacts músicos ≥ 1)
   [ ] Criar seu primeiro evento               (events ≥ 1)
   [ ] Enviar um pré-contrato                  (precontracts ≥ 1)
   [ ] Conectar WhatsApp (opcional/plano)      (whatsapp_channels ≥ 1)
```

Regras: **uma** tabela de progresso (`workspace_onboarding_progress`) com `dismissed_at`/`completed_at`; os itens são derivados de contagens reais (sem flags "visto"); tours por página ficam opcionais e só em `localStorage`; o fluxo demo/fake vira um "modo demonstração" opcional ou é removido. Reaproveitar: `bootstrapWorkspaceForUser`, `OnboardingChecklistClient`, `SmartEmptyState`/`OperationalEmptyState`, `countFacts` de `flow-status`.

---

## F. Billing / Asaas

### Ciclo atual

| Etapa | Implementado? | Funcional? | Testável? | Seguro? | Idempotente? | Observação |
|---|---|---|---|---|---|---|
| FREE automático | Sim (trigger `ensure_workspace_free_subscription`) | **Sim** | Sim | Sim | `on conflict do nothing` (há índice único parcial) | Único item que funciona. Workspace `default` da Harmonics também está no FREE (plan_key `internal` só no `workspaces`). |
| Escolher plano | Parcial (`/assinar`) | **Não** | — | — | — | Planos hardcoded `free/plus/premium` (R$0/97/197); banco tem `free/starter/pro/enterprise/white_label` (0/97/197/497/997). Página fora do shell, sem auth, sem plano atual. |
| Checkout | Parcial (`/api/billing/subscribe`) | **Não** | Não | Não | **Não** (duplo clique = 2 assinaturas no Asaas) | Consulta `workspace_plans.is_active` (coluna inexistente) → sempre 404. Usa client com RLS em `workspace_subscriptions` (RLS on, 0 policies) → leitura/escrita silenciosamente vazias. Lê `profiles.full_name/phone` (inexistentes). Grava colunas `asaas_*` inexistentes. Marca `status:'trialing'` antes de pagar. |
| Asaas client | Sim (`src/lib/asaas/client.ts`) | Provável | Sem testes | Chave por env | — | `ASAAS_ENV` default sandbox. |
| Webhook | Parcial (`/api/webhooks/asaas`) | **Não** | Não | **Não**: se `ASAAS_WEBHOOK_SECRET` não estiver definido, aceita qualquer POST | **Não**: dedupe por `payload.id` numa tabela que não existe; insert sem checar erro; sem ordenação por data do evento | `PAYMENT_RECEIVED/CONFIRMED` (status `RECEIVED/CONFIRMED`) não mapeados → **assinatura nunca vira `active`** por pagamento. `PENDING→trialing` incorreto. `update().order().limit()` para marcar processado é inválido. |
| Recursos liberados | Não | — | — | — | — | Nenhuma rota consulta o plano, exceto WhatsApp (soft). |
| Renovação | Não | — | — | — | — | `current_period_end` recebe `dueDate` do pagamento, mas nada usa. |
| Atraso / inadimplência | Mapeamento `OVERDUE→past_due` | Não (coluna/tabela) | — | — | — | Sem carência, sem bloqueio, sem aviso. `past_due` continua contando como plano ativo. |
| Cancelamento | Parcial (`/api/billing/cancel`) | **Não** | — | **Não** filtra workspace (pega "a última assinatura visível") | — | `/assinatura` envia `<form method=post>` e recebe JSON cru. Cancela imediatamente (sem "até o fim do período"). |
| Reativação | Não | — | — | — | — | — |

### Nomenclatura de status (inconsistências)

`active`, `trialing`, `past_due`, `paused`, `expired`, `cancelled` (código grava com 2 "l") × `canceled_at` (coluna nova, 1 "l") × `cancelled_at` (coluna existente) × Asaas `CANCELED`. Precisa de um enum único (ex.: `free | trialing | active | past_due | suspended | canceled`) e uma tabela de transições.

### O que falta (mínimo para cobrar)

1. Aplicar/reescrever migration de billing: colunas do gateway em `workspace_subscriptions`, `billing_events` com **unique (provider, event_id)**, `event_created_at` para ordenação; RLS com SELECT para membros do workspace.
2. Catálogo único de planos no banco (com `is_active`, `asaas_value`, ordem de exibição); UI lê do banco.
3. `subscribe`: autenticação via `requireWorkspaceAdmin`, service role, idempotência (reusar assinatura pendente/customer), não mudar status antes do pagamento.
4. Webhook: segredo **obrigatório**, dedupe por id do evento (constraint), processamento por máquina de estados ignorando eventos mais antigos que o último aplicado, mapear `PAYMENT_CONFIRMED/RECEIVED → active`, `PAYMENT_OVERDUE → past_due`, `SUBSCRIPTION_DELETED/INACTIVATED → canceled`, retorno 200 rápido e reprocessamento de falhas.
5. Política de inadimplência (carência N dias → somente leitura) e de downgrade.
6. Tela de assinatura completa (seção 8 abaixo) dentro do shell.
7. Teste end-to-end no **sandbox Asaas** com um workspace QA em ambiente separado.

### Tela de assinatura (estado atual)

`/settings/billing`: mostra nome do plano/status/IDs Asaas (técnicos, para o usuário final) e lista de limites genérica sem números; "Gerenciar assinatura" leva para `/assinar` (fora do layout, tema escuro diferente). `/assinatura`: página crua sem layout. Não há preço, próxima cobrança real, método de pagamento, histórico, falha de pagamento, upgrade/downgrade, reativação, feedback de retorno do checkout ou layout mobile pensado. Ambas consultam `workspace_subscriptions` com o client RLS (0 policies) → **sempre mostram "Free / active" por fallback**, mesmo que algo estivesse ativo.

---

## G. Multi-tenant e segurança — riscos encontrados

### CRÍTICO

| ID | Risco | Onde |
|---|---|---|
| C1 | 23 tabelas sem RLS, `anon` com SELECT/INSERT/UPDATE/DELETE. Inclui `google_oauth_credentials` (refresh/access token), `workspace_settings` (todos os tenants), `workspace_plans` (alguém pode zerar preço/limites), `pricing_settings`, `client_reviews`, `users`, `scale_templates`, `scale_template_items`, `roles`, `assignments`, `event_role_slots`, `suggestion_*` e 5 tabelas `suggestion_songs_backup_*`. | [DB] advisor `rls_disabled_in_public` |
| C2 | Auto-promoção a admin global: `GRANT UPDATE(role) ON profiles TO authenticated` + policy `profiles_update_own`. Com `role='admin'`: `profiles_admin_all` (todos os perfis), `current_user_can_access_event()` = true para **qualquer evento** → SELECT em `events`, `contracts`, `precontracts`, `payments`, `repertoire_*`, `event_musicians` de todos os workspaces; na API, `requireAdmin*` libera `admin/usuarios` (criar/alterar usuários) e `getCurrentWorkspace` aceita o workspace `default` da Harmonics via cookie. | [DB] + `lib/api/require-admin.js`, `lib/api/require-workspace-access.js:155`, `lib/workspaces/get-current-workspace.js:430-455` |
| C3 | Rotas sem autenticação que alteram dados: `app/api/automation/rules/[id]`, `automation/templates/[id]`, `automation/channels/[id]` (opera no workspace "padrão" = Harmonics; trocar `api_url`/`api_key` desvia mensagens), `contracts/archive` (cancela qualquer pré-contrato/contrato por id), `contracts/internal/pdf` (gera e **substitui o PDF** de um contrato com HTML enviado), `whatsapp/send-invite` (dispara WhatsApp), `google/oauth/force-reauth` (desativa credencial Google de qualquer `userId` → para a geração de contratos), `test-automation`. | arquivos citados |
| C4 | Buckets `contract-pdfs` e `payment-proofs` públicos, sem limite de tamanho/MIME, com policy SELECT pública em `storage.objects` (permite listar). | [DB] `storage.buckets` |

### ALTO

| ID | Risco | Onde |
|---|---|---|
| A1 | Dashboard/pagamentos consultam via client sem `workspace_id`; para a conta admin a RLS retorna dados de todos os tenants (já hoje mistura `banda-ok`/`banda-teste` quando tiverem dados). Cache `dashboardMemoryCache` em módulo não é chaveado por workspace/usuário. | `app/(admin)/dashboard/page.js:34,713-815`, `app/(admin)/pagamentos/page.js` |
| A2 | Fallback de canal WhatsApp e telefone de alerta = "primeiro `workspace_settings` ativo" (sem ordem). Mensagens de um cliente podem sair pelo número da Harmonics; alertas de um tenant podem ir para o admin de outro. | `lib/whatsapp/send-whatsapp-message.js:183`, `lib/whatsapp/send-admin-alert.js:63`, `lib/automation/resolve-recipient.js:24` |
| A3 | Preços e custos globais (`pricing_settings`/`finance_cost_defaults` slug `default`): telas de eventos/pagamentos leem **e gravam** neles. | `app/(admin)/eventos/page.js:826,852,1325-1366`, `app/(admin)/pagamentos/page.js:713-785` |
| A4 | Rotas "admin global" sem filtro de workspace: `admin/contract-templates/[id]`, `admin/event-types/[id]` (PATCH/DELETE por id), `repertoire/delete`, `events/[id]/external-contract`, `automation/rules` (`scopeWorkspace` devolve **todas** as regras se o workspace não resolver). | arquivos citados |
| A5 | `/api/debug/full`, `/api/debug/auth-supabase`, `/api/debug/verify/[token]`, `/api/debug/contracts/[token]/pdf` publicados em produção. | `app/api/debug/*` |
| A6 | Webhook Asaas aceita qualquer requisição quando `ASAAS_WEBHOOK_SECRET` não está definido; cron idem com `CRON_SECRET` (workflow do GitHub tem fallback sem segredo; segredo também aceito via `?secret=` na URL, que vai para logs). | `app/api/webhooks/asaas/route.js:12`, `app/api/automation/cron/route.js:92` |
| A7 | `POST /api/automation/channels/ping` sem auth faz `fetch` para URL arbitrária (SSRF/proxy aberto). | arquivo citado |
| A8 | Funções `SECURITY DEFINER` executáveis por `anon` (12) e view `suggestion_songs_ranked` SECURITY DEFINER. | [DB] advisors |

### MÉDIO

| ID | Risco | Onde |
|---|---|---|
| M1 | `current_user_contact_id()` casa contato por e-mail em **qualquer** workspace (LIMIT 1). Se "Confirm email" estiver desligado no Auth, alguém pode se cadastrar com o e-mail de um músico e herdar o acesso dele. Verificar configuração do Auth. | [DB] |
| M2 | `contract_adjustment_requests`: INSERT público com `with_check true` (spam). `event_types`: SELECT `true` para qualquer autenticado (lê tipos/valores de outros tenants). | [DB] |
| M3 | Token público de pré-contrato = `Date.now().toString(36) + Math.random()` (≈41 bits, não criptográfico). | `lib/contracts/generate-precontract-from-event.js:6` |
| M4 | Rate limit em memória (ineficaz em Cloudflare Workers) e aplicado em só 3 rotas; signup/workspace sem limite (criação ilimitada de workspaces). | `lib/api/rate-limit.js` |
| M5 | `GET /api/google/maps-key` devolve a chave a qualquer um (restringir por referrer no Google Cloud). `GET /api/youtube/search` sem auth (consumo de cota). | arquivos citados |
| M6 | Mensagens de erro internas (`error.message` do Postgres) devolvidas ao cliente em dezenas de rotas. | geral |
| M7 | Leaked password protection desativado; Auth com 10 conexões fixas. | [DB] advisors |
| M8 | Cookies `workspace_id` não `httpOnly` (aceitáveis porque membership é validado, mas é um vetor para o bypass C2). | `app/api/workspace/create/route.js` |

### BAIXO

- `search_path` mutável em 8 funções; extensão `unaccent` em `public`.
- Edge Function `assistant-harmonics-schedule` (não versionada no repo, `verify_jwt=false`, autentica contra outro projeto) acessa `contacts/events` com service role — artefato pessoal dentro do banco do produto; documentar ou mover.
- Diretório lixo `GET /api/google/oauth/start` na raiz do repo.

---

## H. Performance — maiores gargalos (ordem de impacto)

Medições do build de produção local (Next 16.2.1/Turbopack):

| Rota | Chunks | JS bruto | JS gzip |
|---|---|---|---|
| `/login`, `/signup`, `/onboarding` | 11 | ~880 KB | ~255 KB |
| `/dashboard` | 14 | 969 KB | 281 KB |
| `/eventos` | 15 | 1.052 KB | 305 KB |
| `/membro` | 13 | 1.044 KB | 298 KB |
| `/pagamentos` | 14 | 987 KB | 286 KB |

(Métricas de runtime contra produção não foram possíveis: o proxy deste ambiente bloqueia `app.bandaharmonics.com`.)

1. **Custo fixo por chamada de API (6–8 round-trips antes da query útil).** `requireWorkspaceAccess` chama `auth.getUser` (rede para o GoTrue), depois `getCurrentWorkspace` chama `auth.getUser` **de novo**, busca profile, membership, workspace, settings (às vezes 2×), profile role de novo e membership de novo — tudo sequencial, do Worker até `us-east-1`. Estimativa: 300–800 ms de overhead por request. `/eventos` faz ≥3 dessas chamadas na carga.
2. **Tudo é client-side.** `app/(admin)/layout.js` é `'use client'`; `AuthProvider` bloqueia a tela inteira em "Verificando sessão..." até resolver; todas as páginas fazem fetch em `useEffect` após hidratar (HTML → JS → sessão → workspace/me → dados). Nenhum `loading.js`/`error.js` no app. `AdminShell` é renderizado dentro de cada página (não no layout) → shell desmonta/remonta a cada navegação.
3. **Waterfalls explícitos no dashboard**: lote primário (4 queries) → `antesala` (sequencial) → lote "heavy" (3 queries), todos do browser, sem `workspace_id`, com até `DASHBOARD_FETCH_LIMIT` linhas cada. Agregações (KPIs) calculadas no cliente sobre listas.
4. **Peso global no root layout**: Google Maps Places carregado em **todas** as páginas (inclusive login e portal do membro); `GlobalPlayerRoot`, `ClientRepertoireHotfixes` e `ContractPreviewMobileFix` (patches de DOM via `MutationObserver`) montados em todo o app; supabase-js (~219 KB bruto) em todas as rotas.
5. **Páginas monolíticas**: `ClienteHome.js` 6.158 linhas, `contrato/[token]` 3.802, `eventos` 2.649, `SuggestoesPageClient` 2.357, `PreContratosClient` 2.288, `pagamentos` 2.229 — sem `dynamic()` para abas/modais.
6. **Listas sem paginação real**: listagens com `limit` fixo (ex.: `ADMIN_LIST_LIMIT`) e filtros no cliente; 154 `select('*')`.
7. **Prefetch**: só desktop, 450 ms após montar, até 12 rotas (todos os módulos) — baixa JS, não dados; mobile não faz prefetch.
8. **Banco**: dados ainda pequenos (≤ 530 linhas por tabela), então índices não são gargalo hoje. Já existem `workspace_id` simples nas tabelas principais; faltarão compostos quando houver volume: `events(workspace_id, event_date)`, `payments(workspace_id, created_at)`, `precontracts(workspace_id, status)`, `contracts(workspace_id, status)`. Há 10 índices duplicados, 27 FKs sem índice e 5 policies com `auth.uid()` reavaliado por linha (advisors). Não criar nada antes de existir volume/medição.

### Performance percebida — recomendações
- Layout servidor persistente com shell (sidebar/topbar) fora das páginas; `loading.js` por segmento com skeletons.
- Resolver sessão + workspace **uma vez** por request (React `cache()` no servidor) e passar contexto; eliminar o segundo `getUser`.
- Server Components para dados primários do dashboard/eventos, dados secundários via Suspense/streaming.
- Cache de cliente (SWR/React Query) chaveado por `workspaceId`, com stale-while-revalidate e invalidação nas mutações; prefetch apenas de Eventos/Agenda/Clientes a partir do dashboard.
- Carregar Google Maps sob demanda (só no formulário de local).

---

## Cache — situação atual

| Camada | O que existe | Risco entre workspaces |
|---|---|---|
| `useWorkspaceMe` | cache em módulo 5 min (stale 30 min), invalidável por evento | Baixo — mas não é limpo no logout |
| `dashboardMemoryCache` | variável de módulo, TTL | **Médio**: não chaveado por workspace/usuário |
| `useCurrentWorkspace` | grava `harmonics:last-current-workspace` no localStorage, não renderiza do cache | Baixo |
| `lib/client/light-cache.js` | cache leve em 5 arquivos | Verificar chave por workspace |
| `lib/youtube/searchCache.js` | memória do servidor | Nenhum (dado público) |
| Next/HTTP | APIs `force-dynamic`/`no-store`; nada de `unstable_cache`/`revalidate` | Nenhum (por ausência) |

Nada privado é cacheado no servidor hoje — bom para segurança, ruim para velocidade. Qualquer cache futuro **deve** incluir `workspaceId` na chave.

---

## Empty states (conta com 0 dados)

- Componentes existentes: `SmartEmptyState` (usado só em `eventos/tipos` e `automacoes/canais`) e `OperationalEmptyState` (usado por `OperationalRouteOnboarding`).
- O resto mostra apenas texto: "Nenhum evento encontrado.", "Nenhum contrato encontrado.", "Nenhuma escala encontrada.", "Nenhum contato encontrado — Ajuste os filtros…" (sugere filtro, não criação).
- Dashboard de conta nova: KPIs zerados; o guia só aparece com `?onboarding=fresh-workspace`.
- Páginas que dependem de dados globais/legados podem parecer quebradas para conta nova: `/templates-escala` (coluna inexistente), automações (403 por exigir admin global), edição de template de contrato e tipos de evento (403).

---

## Mobile

Pontos positivos: `AdminBottomNav`, `AdminMobileTopbar`, drawers, guardas específicas (`MobileScaleWorkspaceGuard`, `MobileLogsPayloadGuard`), 34 usos de `safe-area`, inputs com 16 px (sem zoom no iOS). Pontos a validar em dispositivo: tabelas em `pagamentos`, `pagamentos/operacional`, `EventosPricingTab`, `RegrasPageClient`; modais longos em pré-contratos/contrato; peso de ~300 KB gzip de JS em 4G; `/assinar` e `/assinatura` sem layout mobile. **Validação visual não foi possível** neste ambiente (sem credenciais de um ambiente não-produtivo).

## PWA

`public/site.webmanifest` existe (nome, ícones 192/512, `display: standalone`, tema preto), mas **não é referenciado** no `metadata` → navegador não detecta. Faltam `start_url`, `scope`, ícone `maskable`, `theme-color`/`viewport` no layout, `lang="pt-BR"`, service worker (mínimo: cache de assets estáticos + página offline) e estratégia de atualização. `og-image.png` tem 912 KB.

## Resiliência

| Cenário | Comportamento atual |
|---|---|
| Internet cai durante cadastro | Se cair entre `signUp` e bootstrap: usuário sem workspace; recuperação via login → `/workspace/new` (dados redigitados). |
| Clique duplo em "criar workspace" | **Cria 2 workspaces** (sem checagem nem lock). |
| Clique duplo em criar evento / salvar | Depende do botão desabilitar; não há chave de idempotência nas APIs. |
| Webhook duplicado / fora de ordem | Sem proteção efetiva (tabela inexistente; sem ordenação). |
| Supabase 500 | Muitas telas engolem erro e mostram lista vazia (`Promise.allSettled` → `[]`), parecendo "sem dados". |
| Sessão expira | `AuthContext` detecta `SIGNED_OUT` e redireciona; APIs retornam 401 com mensagem. OK. |
| Duas abas | `invalidateWorkspaceMeCache` só na aba atual; caches de módulo divergem. |
| Pagamento aprovado com billing aberto | Tela não atualiza (página estática, sem polling/realtime). |
| Envio de convites | Há lock (`invite-send-lock`) mas colunas `sending_at/sending_token` não existem no banco → lock desativado silenciosamente. |

## Observabilidade

Existe `lib/observability/server-log.js` (com máscara de e-mail/token, usado em 14 arquivos) e `automation_logs`/`automation_cron_runs`/`workspace_activity_events`/`op_finance_audit`. Não existe: rastreamento de erros (Sentry ou similar), request id/correlação, logs estruturados por `workspace_id`/`user_id`, métricas de latência, alerta de falha de cron/webhook. `billing_events`, `usage_events`, `file_access_logs` e `audit_logs` estão no código/SQL mas não no banco. Responder "por que o cliente X não conseguiu criar um evento?" hoje exige procurar `console.error` nos logs do Worker por texto livre.

---

## I. Legado / duplicidade (mapeado, nada apagado)

| Tema | Itens |
|---|---|
| Criação de workspace | `/api/public/signup/bootstrap` e `/api/workspace/create` (ambos usam `bootstrapWorkspaceForUser`, mas um checa workspace existente e o outro não; marcam onboarding de formas diferentes) |
| Workspace atual | `getCurrentWorkspace` (lib), `/api/workspace/current`, `/api/workspace/me`, `useCurrentWorkspace`, `useWorkspaceMe`, `getDefaultWorkspaceSettings`, `getCurrentAutomationWorkspaceSettings`, `isPrimaryHarmonicsWorkspace` |
| Guards de auth | `require-workspace-access`, `require-admin`, `require-admin-server`, `require-schedule-manager-access`, `ProtectedRoute`, `WorkspaceModuleGuard`, middleware — com 8 cópias de `createCookieSupabaseClient`, 9 de `normalizeRole`, 12 de `isMissingColumnError` |
| Onboarding | 4 gerações (seção E); `PrecontractGuideStable` (morto) vs `V2`; `TemplateCreationGuide` (morto) vs `Stable` |
| Billing | `/assinar` + `/assinatura` + `/settings/billing`; planos hardcoded × banco |
| Stripe/PMS | `supabase/migrations/20260521_stripe_pms_migration_core_v1.sql` e `src/lib/migration/import-member.ts`/`app/admin/migracao` parecem pertencer a **outro produto** (o projeto Supabase "Harmomus-app" tem `legacy_stripe_*`, `legacy_pms_subscriptions`); não aplicados aqui |
| Contrato público | `/api/contracts/public/[token]` e `/api/public/contracts/[token]` (+ `/sign` em ambos) |
| Reset de senha | `resetPasswordForEmail → /login?reset=done` (login e settings) × `/api/auth/request-password-reset → /auth/reset-password` (sem uso na UI) × `/api/public/ativar-conta` |
| Shell | `components/admin/AdminShell.js` (reexporta) + `components/layout/AdminShell.jsx`; `layout/AppShell`, `layout/Sidebar`, `layout/Header` sem uso |
| Player | `GlobalPlayerHost.jsx` (sem uso) vs `GlobalPlayerHostFixed.jsx` |
| Dependências | `@supabase/auth-helpers-nextjs` instalado e não usado |
| Patches de build | 22 `scripts/patch-*.mjs` + `zz-note.txt` |
| Hotfixes de DOM | `ClientRepertoireHotfixes`, `ContractPreviewMobileFix` (MutationObserver global) |
| Banco | `users`, `roles`, `assignments`, `event_role_slots`, `default-antigo` (workspace inativo), 5 tabelas `suggestion_songs_backup_20260414*`, `operational_backup.initial_snapshot`, `profiles` com 3 policies de SELECT redundantes, 10 índices duplicados |
| Rotas mortas/quebradas | `/settings/white-label` (link sem rota), restart para `/automacao`, `/escalas/templates` reexporta `/templates-escala` |
| Migrations | 46 arquivos no repo, 3 registradas no banco; `supabase/sql/` com scripts de "fase" que nunca rodaram; dois `finance_cost_defaults` (central/hardening) |

---

## J. Plano de finalização

### FASE 0 — Segurança / bloqueadores (antes de qualquer cliente externo; ~1 semana)

**Alterar**
1. Banco (migration revisada, aplicada primeiro em branch/staging):
   - Habilitar RLS em todas as tabelas de `public`; policies por workspace onde houver `workspace_id`; `REVOKE ALL` de `anon` nas tabelas internas; `google_oauth_credentials` acessível só por service role; `workspace_plans` só leitura.
   - `REVOKE UPDATE (role) ON profiles FROM authenticated` (ou trigger que impede alterar `role`); trocar `current_user_is_admin()` por flag de plataforma em tabela própria (`platform_admins`) não editável pelo usuário.
   - `REVOKE EXECUTE ... FROM anon` nas funções SECURITY DEFINER; `search_path` fixo.
   - Buckets privados + URLs assinadas (o código já tem `signed-url` e `payment-proof-storage`) + limite de tamanho/MIME.
2. API: adicionar `requireWorkspaceAdmin` + filtro `workspace_id` nas rotas de C3/A4; remover `/api/debug/*`; segredo obrigatório no webhook e no cron (sem `?secret=`); bloquear `channels/ping` a hosts permitidos.
3. Substituir os guards "admin global" por `requireWorkspaceAdmin` nas rotas de gestão (B8).
4. Remover fallbacks "primeiro workspace ativo" de WhatsApp/alertas (falhar fechado).
5. Antes de mudar RLS: substituir as consultas client-side diretas (dashboard, pagamentos, eventos/pricing, templates-escala) por chamadas de API — senão a RLS nova quebra a operação da banda.

**Dependências:** inventário das consultas client-side (item 5) antes do item 1. Rotação do refresh token Google e da service role key **depois** de fechar o acesso (considerar comprometidos).
**Risco:** alto de regressão na operação atual → fazer em staging com cópia do banco e checklist da banda.
**Como testar:** script com a chave `anon` tentando ler/escrever cada tabela (deve falhar); usuário comum tentando `update profiles set role='admin'`; usuário do workspace A tentando acessar ids do workspace B em todas as rotas; advisors do Supabase sem ERROR.

### FASE 1 — Jornada SaaS (~1–2 semanas)

**Alterar:** aplicar (ou descartar conscientemente) as migrations pendentes e registrar todas em `supabase_migrations`; remover o código de fallback por coluna após isso; mover `pricing_settings`, `finance_cost_defaults`, `scale_templates(_items)` para `workspace_id` com seed no bootstrap; bootstrap idempotente (um workspace "em criação" por usuário, chave de idempotência); fluxo de signup/confirmação/`/auth/callback`; reset de senha único em `/auth/reset-password`; onboarding simplificado (seção E) com uma fonte de verdade; empty states com CTA em todas as listas; seletor de workspace (se for suportado mais de um por usuário).
**Dependências:** Fase 0.
**Risco:** médio (migração de dados globais para o workspace da Harmonics — copiar, não mover).
**Como testar:** roteiro "Cliente Zero" (seção K) em staging, incluindo abandono no meio e retorno, duas abas, duplo clique.

### FASE 2 — Billing (~1–2 semanas)

**Alterar:** seção F inteira; enforcement de limites no backend (`requireWorkspaceLimit` nas rotas de criação de evento, convite de membro, envio WhatsApp, geração de contrato) com `usage_events` ou contagem direta; tela de assinatura completa; política de inadimplência; e-mails transacionais de cobrança.
**Dependências:** Fase 0 (RLS de subscription) e Fase 1 (catálogo de planos/limites decidido).
**Risco:** médio; usar sandbox Asaas.
**Como testar:** ciclo completo no sandbox: assinar → pagar (PIX/boleto/cartão) → webhook → ativo → renovar → atrasar → past_due → bloquear → regularizar → cancelar → reativar; reenviar o mesmo webhook 3× e fora de ordem; tentar exceder limite pela API diretamente.

### FASE 3 — Performance (~1–2 semanas)

**Alterar:** layout servidor com shell persistente + `loading.js`; resolução de sessão/workspace uma vez por request (sem segundo `getUser`, cache por request); dashboard com endpoint agregado server-side e streaming; cache de cliente chaveado por workspace; Google Maps sob demanda; `dynamic()` para abas/modais pesados; paginação real nas listas; remover hotfixes de DOM incorporando-os aos componentes; eliminar os `scripts/patch-*.mjs` aplicando as mudanças no código-fonte.
**Dependências:** Fase 0/1 (o modelo de dados precisa estar estável).
**Risco:** médio (páginas grandes).
**Como testar:** Lighthouse/WebPageTest mobile antes/depois; tempo de API p50/p95 nos logs do Worker; meta: shell < 1 s, conteúdo primário < 2 s em 4G, JS inicial < 150 KB gzip.

### FASE 4 — UX / mobile / PWA (~1 semana)

**Alterar:** manifest linkado + `start_url`/`maskable`/`theme-color`/viewport, `lang="pt-BR"`, service worker de assets estáticos com estratégia de atualização; revisão mobile das telas listadas; tabelas → cards no mobile; tela de assinatura responsiva.
**Como testar:** instalação em Android/iOS, Lighthouse PWA, revisão visual em 360/768/1280 px.

### FASE 5 — QA final e lançamento (~1 semana)

**Alterar:** Sentry (ou equivalente) com `workspace_id`/`user_id`; request id em todas as APIs; alerta de falha de cron/webhook; testes automatizados (isolamento entre tenants, billing, limites); termos de uso/privacidade/LGPD; backup e plano de rollback; ambiente de staging permanente.
**Como testar:** checklist K completo em staging e depois em produção com conta QA.

---

## K. Critério de "pronto" — checklist objetivo

**Segurança e isolamento**
- [ ] Advisors de segurança do Supabase sem nível ERROR.
- [ ] Nenhuma tabela de `public` acessível com a chave `anon` além das explicitamente públicas (e documentadas).
- [ ] Usuário comum não consegue alterar `profiles.role` nem qualquer flag de plataforma.
- [ ] Teste automatizado: usuário do workspace A recebe 403/404 em **todas** as rotas ao usar ids do workspace B.
- [ ] Todas as rotas de escrita exigem sessão + membership (ou token público específico do recurso).
- [ ] Contratos e comprovantes só via URL assinada com expiração.
- [ ] Webhook e cron rejeitam requisições sem segredo.
- [ ] Rotas `/api/debug/*` removidas; credencial Google e service role rotacionadas.

**Jornada**
- [ ] Conta nova → workspace pronto em ≤ 2 telas após o cadastro, com e sem confirmação de e-mail.
- [ ] Interromper em qualquer ponto e voltar retoma sem duplicar workspace.
- [ ] Recuperação de senha funciona ponta a ponta.
- [ ] Onboarding com uma fonte de verdade, persistente, pulável e reabrível.
- [ ] Todas as listas principais têm empty state com CTA.
- [ ] Nenhuma configuração de um workspace é lida/gravada por outro (preços, custos, templates, canais, alertas).

**Billing**
- [ ] Planos exibidos = planos do banco.
- [ ] Ciclo completo validado no sandbox Asaas (assinar, pagar, renovar, atrasar, bloquear, regularizar, cancelar, reativar).
- [ ] Webhook idempotente e resistente a ordem (teste com reenvio e inversão).
- [ ] Limites de plano aplicados no backend e testados via API direta.
- [ ] Tela de assinatura mostra plano, preço, status, próxima cobrança, método, histórico e ações.

**Qualidade**
- [ ] Código no git = código em produção (sem patches de prebuild).
- [ ] Todas as migrations aplicadas e registradas; sem fallbacks por coluna ausente.
- [ ] Erros de produção rastreados com `workspace_id`/`user_id`.
- [ ] Shell < 1 s e conteúdo primário < 2 s em 4G nas rotas Dashboard/Eventos/Agenda.
- [ ] PWA instalável em Android e iOS.
- [ ] Termos de uso e política de privacidade publicados.

---

## Teste "Cliente Zero" — bloqueio

Não foi executado em runtime. Motivos:
1. Este ambiente não tem `SUPABASE_SERVICE_ROLE_KEY` nem um banco de staging; a maioria das APIs depende do service role.
2. O único banco acessível é o de produção da banda. Criar conta/workspace QA nele **grava em produção** (auth, workspace, assinatura FREE, settings) e, com os problemas de isolamento atuais (C1/C2/A2), um usuário de teste interage com dados globais da Harmonics. Pela regra "não usar produção para testes", não foi feito.
3. O proxy deste ambiente bloqueia acesso a `app.bandaharmonics.com`.

**Para desbloquear:** criar um branch do Supabase (ou um projeto staging com cópia do schema + seed), fornecer as variáveis de ambiente de staging e o sandbox do Asaas. Com isso o roteiro da seção K pode ser executado com Playwright (já disponível no ambiente).
