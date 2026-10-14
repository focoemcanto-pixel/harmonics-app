# Finalização SaaS — checklist de progresso

Legenda: ✅ concluído · 🟡 parcial · ⛔ bloqueio externo · ⏳ pendente

## Fase 0 — Contenção de segurança
- ✅ 0.1 Matriz de acesso das 23 tabelas (`ACCESS_MATRIX.md`)
- ✅ 0.2 Escalonamento via `profiles.role` bloqueado no banco (trigger `trg_guard_profile_privilege_columns`), testado ao vivo
- ✅ 0.x RLS + revoke anon nas 23 tabelas, com políticas de compatibilidade (aplicado em produção 2026-10-14, migrations `20261014090000/0100/0200`)
- ⛔ 0.4 Storage: remoção da listagem (BE-1) e buckets privados (BE-2)
- ⛔ 0.5 Rotação do token Google (BE-3)

### Fase 0b — APIs (código; vale em produção após deploy — BE-4)
- ✅ Helper central `lib/api/route-guards.js` (member/admin/platform/internal/debug + `assertRowInWorkspace` com 404 anti-enumeração)
- ✅ Protegidas (antes sem autenticação): `automation/rules/[id]`, `automation/templates/[id]`, `automation/channels/[id]` (PATCH/DELETE), `automation/channels/ping` (+ allowlist de host anti-SSRF), `automation/test-channel`, `whatsapp/send-invite` (+ convite precisa ser do workspace), `contracts/archive`, `contracts/internal/pdf`, `contracts/html-to-pdf` (interno via `INTERNAL_API_KEY` ou admin do workspace + checagem de posse), `google/oauth/force-reauth`, `test-automation`, `escalas/enviar-convite` (admin de plataforma), `debug/*` (404 salvo `ENABLE_DEBUG_ROUTES=true` + admin de plataforma)
- ✅ Rotas que exigiam admin global agora exigem admin **do workspace** e filtram por ele: `admin/contract-templates/[id]`, `admin/event-types/[id]`, `automation/{rules,templates,channels,logs}`, `repertoire/delete`, `events/[id]/external-contract`. Escopo "fail-closed" quando o workspace não resolve.
- ✅ Bug cross-tenant corrigido: marcar template de contrato como padrão desmarcava o padrão de todos os workspaces.
- ✅ Proxy `onboarding/progress` não confia mais em `x-forwarded-host` ao repassar cookies.
- ✅ Testes: `npm test` (72 ✓, inclui IDOR/fail-closed/chave interna/debug). `tests/oauth-integration.test.mjs` já falhava antes (4 falhas, pré-existente) → isolado em `npm run test:oauth-legacy`.
- ✅ Build de produção ok.
- ⏳ Mantidas como admin de plataforma (operação Harmonics) até serem escopadas na Fase 1: `automation/payment-reminders/{config,run}`, `automation/retry`, `cron/payment-reminders`, `admin/usuarios/*`, `admin/repertorio/*`, `admin/reviews`.
- Classificação completa: `API_ACCESS.md`.

## Fase 1 — Multi-tenant real
- ✅ 1.1 `pricing_settings`, `finance_cost_defaults`, `scale_templates` com `workspace_id` (aditivo, backfill → Harmonics). `/api/settings/pricing` por workspace; portais e assinatura de contrato resolvem preço/custo pelo workspace do evento; `/templates-escala` voltou a funcionar.
- ✅ 1.1 WhatsApp/alertas: workspace usa só o próprio canal/telefone; o workspace dono das variáveis legadas (Harmonics) mantém o caminho anterior idêntico (shim `lib/whatsapp/legacy-env-workspace.js`).
- ✅ 1.2 Autorização: `route-guards` + otimização de `requireWorkspaceAccess` (2 Auth + 6 consultas sequenciais → 1 Auth + 4 consultas em 3 ondas).
- ✅ 1.3 RLS: `current_user_can_access_event` sem bypass de admin global (o dashboard da Harmonics não mistura mais outros tenants). Teste A×B no banco: SELECT/UPDATE/INSERT negados (`supabase/tests/tenant_isolation_a_vs_b.sql`).
- 🟡 Decisão de produto pendente (D-1): `finance_cost_defaults` está com RLS sem política desde antes desta fase, então o browser **nunca** leu/gravou os custos padrão salvos (as telas usam valores de fallback). Habilitar mudaria os números exibidos à Harmonics — mantido como está até decisão.
- ⏳ Ainda globais por desenho: catálogo de sugestões (`suggestion_*`), `event_types` legível por qualquer autenticado (RLS `true`), `contract_templates` com políticas de admin global (a API já usa admin do workspace).
- ⏳ Achado (privacidade intra-tenant): músicos escalados conseguem ler `payments`/`contracts` dos eventos em que tocam (política pré-existente `*_member_select_*`). Não alterado: o portal do membro pode depender disso — validar antes de restringir.
