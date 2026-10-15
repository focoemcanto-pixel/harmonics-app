# Classificação de endpoints (gerada em 2026-10-14, após Fase 0b)

Critério: guard detectado no código. PUBLIC TOKEN = autorização por token do recurso (contrato/portal/convite).

| Endpoint | Classe |
|---|---|
| `/api/admin/contract-templates/[id]` | WORKSPACE ADMIN |
| `/api/admin/contract-templates` | WORKSPACE ADMIN |
| `/api/admin/event-types/[id]` | WORKSPACE ADMIN |
| `/api/admin/event-types` | WORKSPACE ADMIN |
| `/api/admin/migration/import` | WORKSPACE ADMIN |
| `/api/admin/repertorio/liberar-revisao` | PLATFORM ADMIN |
| `/api/admin/repertorio/smart-suggestions` | WORKSPACE MEMBER |
| `/api/admin/repertorio/use-suggestion` | PLATFORM ADMIN |
| `/api/admin/reviews` | PLATFORM ADMIN |
| `/api/admin/storage-migrations/run` | WORKSPACE MEMBER |
| `/api/admin/suggestions/client-panel-songs/import` | WORKSPACE ADMIN |
| `/api/admin/suggestions/client-panel-songs` | WORKSPACE MEMBER |
| `/api/admin/suggestions/enrich-catalog` | PLATFORM ADMIN |
| `/api/admin/suggestions/repertoire-songs/import` | WORKSPACE ADMIN |
| `/api/admin/suggestions/repertoire-songs` | WORKSPACE MEMBER |
| `/api/admin/usuarios/[id]` | PLATFORM ADMIN |
| `/api/admin/usuarios/invite` | PLATFORM ADMIN |
| `/api/admin/usuarios` | PLATFORM ADMIN |
| `/api/auth/request-password-reset` | PUBLIC |
| `/api/automation/channels/[id]` | WORKSPACE ADMIN |
| `/api/automation/channels/ping` | WORKSPACE ADMIN |
| `/api/automation/channels` | WORKSPACE ADMIN |
| `/api/automation/contracts/unsigned-alerts` | PLATFORM ADMIN |
| `/api/automation/cron` | CRON |
| `/api/automation/dashboard` | WORKSPACE ADMIN |
| `/api/automation/entity-options` | WORKSPACE ADMIN |
| `/api/automation/logs` | WORKSPACE ADMIN |
| `/api/automation/payment-reminders/config` | PLATFORM ADMIN |
| `/api/automation/payment-reminders/run` | PLATFORM ADMIN |
| `/api/automation/retry` | PLATFORM ADMIN |
| `/api/automation/rules/[id]` | WORKSPACE ADMIN |
| `/api/automation/rules` | WORKSPACE ADMIN |
| `/api/automation/send` | WORKSPACE ADMIN |
| `/api/automation/templates/[id]` | WORKSPACE ADMIN |
| `/api/automation/templates` | WORKSPACE ADMIN |
| `/api/automation/test-channel` | WORKSPACE ADMIN |
| `/api/automation/test-dispatch` | WORKSPACE MEMBER |
| `/api/billing/cancel` | AUTHENTICATED |
| `/api/billing/subscribe` | AUTHENTICATED |
| `/api/client/review` | PUBLIC TOKEN |
| `/api/cliente/alertas/repertorio-pendente` | PUBLIC TOKEN |
| `/api/cliente/antesala/request` | PUBLIC TOKEN |
| `/api/cliente/pagamentos` | PUBLIC TOKEN |
| `/api/cliente/repertorio/pdf/[token]` | PUBLIC TOKEN |
| `/api/cliente/repertorio/review/[token]` | PUBLIC TOKEN |
| `/api/cliente/repertorio` | PUBLIC TOKEN |
| `/api/cliente/sugestoes` | PUBLIC TOKEN |
| `/api/contacts/delete-many` | WORKSPACE MEMBER |
| `/api/contacts` | WORKSPACE MEMBER |
| `/api/contracts/[id]` | WORKSPACE MEMBER |
| `/api/contracts/[id]/signed-url` | WORKSPACE MEMBER |
| `/api/contracts/archive` | INTERNAL ou WORKSPACE ADMIN |
| `/api/contracts/delete-many` | WORKSPACE MEMBER |
| `/api/contracts/generate` | WORKSPACE MEMBER |
| `/api/contracts/html-to-pdf` | INTERNAL ou WORKSPACE ADMIN |
| `/api/contracts/internal/pdf` | INTERNAL ou WORKSPACE ADMIN |
| `/api/contracts/preview-html/[token]` | PUBLIC TOKEN |
| `/api/contracts/preview/[token]` | PUBLIC TOKEN |
| `/api/contracts/public/[token]` | PUBLIC TOKEN |
| `/api/contracts/public/[token]/sign` | PUBLIC TOKEN |
| `/api/contracts` | WORKSPACE MEMBER |
| `/api/contracts/verify/[token]` | PUBLIC TOKEN |
| `/api/convites` | WORKSPACE MEMBER |
| `/api/cron/payment-reminders` | PLATFORM ADMIN |
| `/api/debug/auth-supabase` | INTERNAL (debug, 404 por padrão) |
| `/api/debug/contracts/[token]/pdf` | INTERNAL (debug, 404 por padrão) |
| `/api/debug/full` | INTERNAL (debug, 404 por padrão) |
| `/api/debug/verify/[token]` | INTERNAL (debug, 404 por padrão) |
| `/api/escalas/enviar-convite` | PLATFORM ADMIN |
| `/api/event-musicians` | WORKSPACE MEMBER |
| `/api/events/[id]/band-notes` | WORKSPACE MEMBER (delegado) |
| `/api/events/[id]/external-contract` | WORKSPACE ADMIN |
| `/api/events/[id]` | WORKSPACE MEMBER |
| `/api/events/[id]/scale-contacts` | WORKSPACE MEMBER (delegado) |
| `/api/events/[id]/scale-data` | WORKSPACE MEMBER (delegado) |
| `/api/events/[id]/scale` | WORKSPACE ADMIN |
| `/api/events/bulk-delete` | WORKSPACE MEMBER |
| `/api/events/import-from-contract` | WORKSPACE ADMIN |
| `/api/events` | WORKSPACE MEMBER |
| `/api/files/contracts/[id]/download` | WORKSPACE MEMBER |
| `/api/files/payments/[id]/download` | WORKSPACE MEMBER |
| `/api/google/maps-key` | PUBLIC |
| `/api/google/oauth/callback` | PUBLIC TOKEN |
| `/api/google/oauth/force-reauth` | PLATFORM ADMIN |
| `/api/google/oauth/start` | AUTHENTICATED |
| `/api/invites/delete-many` | WORKSPACE MEMBER |
| `/api/member/invites/[inviteId]/respond` | AUTHENTICATED |
| `/api/membro/escala/by-client` | PUBLIC TOKEN |
| `/api/membro/global-dashboard` | WORKSPACE MEMBER (delegado) |
| `/api/membro/repertoire-key` | WORKSPACE ADMIN |
| `/api/onboarding/complete` | WORKSPACE MEMBER |
| `/api/onboarding/fake-members` | WORKSPACE MEMBER |
| `/api/onboarding/flow-status` | WORKSPACE ADMIN |
| `/api/onboarding/formation-template` | WORKSPACE MEMBER |
| `/api/onboarding/next-step` | WORKSPACE MEMBER |
| `/api/onboarding/progress` | WORKSPACE MEMBER (proxy para flow-status, que autoriza) |
| `/api/operational-finance` | WORKSPACE MEMBER |
| `/api/payments/[id]/proof-signed-url` | WORKSPACE MEMBER |
| `/api/payments/[id]` | WORKSPACE MEMBER |
| `/api/payments/bulk-delete` | WORKSPACE MEMBER |
| `/api/payments` | WORKSPACE MEMBER |
| `/api/precontracts` | WORKSPACE ADMIN |
| `/api/public/ativar-conta` | PUBLIC |
| `/api/public/contracts/[token]/draft` | PUBLIC TOKEN |
| `/api/public/contracts/[token]/regenerate-pdf` | PUBLIC TOKEN |
| `/api/public/contracts/[token]` | PUBLIC TOKEN |
| `/api/public/contracts/[token]/sign` | PUBLIC TOKEN |
| `/api/public/signup/bootstrap` | AUTHENTICATED |
| `/api/quotes/analyze` | WORKSPACE ADMIN |
| `/api/quotes` | WORKSPACE ADMIN |
| `/api/repertoire/delete-many` | WORKSPACE MEMBER |
| `/api/repertoire/delete` | WORKSPACE ADMIN |
| `/api/repertorios` | WORKSPACE MEMBER |
| `/api/scales/delete-many` | WORKSPACE MEMBER |
| `/api/scales/delete` | WORKSPACE MEMBER |
| `/api/scales` | WORKSPACE MEMBER |
| `/api/storage/payment-proof/preview` | WORKSPACE MEMBER |
| `/api/suggestions/collections/automatic` | WORKSPACE MEMBER |
| `/api/suggestions/genres/[id]` | WORKSPACE MEMBER |
| `/api/suggestions/genres` | WORKSPACE MEMBER |
| `/api/suggestions/import-from-repertoire` | WORKSPACE MEMBER |
| `/api/suggestions/moments/[id]` | WORKSPACE MEMBER |
| `/api/suggestions/moments` | WORKSPACE MEMBER |
| `/api/suggestions/songs/[id]` | WORKSPACE MEMBER |
| `/api/suggestions/songs` | WORKSPACE MEMBER |
| `/api/test-automation` | PLATFORM ADMIN |
| `/api/webhooks/asaas` | WEBHOOK |
| `/api/whatsapp/send-contract-signed` | PUBLIC TOKEN |
| `/api/whatsapp/send-event-invites` | WORKSPACE MEMBER (delegado) |
| `/api/whatsapp/send-invite` | WORKSPACE ADMIN |
| `/api/workspace/activity` | WORKSPACE ADMIN |
| `/api/workspace/create` | AUTHENTICATED |
| `/api/workspace/current` | PUBLIC TOKEN |
| `/api/workspace/delete` | WORKSPACE ADMIN |
| `/api/workspace/health` | WORKSPACE ADMIN |
| `/api/workspace/me` | WORKSPACE MEMBER |
| `/api/workspace/recommendations` | WORKSPACE MEMBER |
| `/api/workspace/team/[memberId]` | WORKSPACE ADMIN |
| `/api/workspace/team` | WORKSPACE ADMIN |
| `/api/youtube/search` | PUBLIC |
