# Segredos internos (BE-9 / BE-10)

Rotas servidor-a-servidor falham fechadas: sem o segredo configurado, nada executa.
Helper: `lib/api/server-secrets.js` (comparação em tempo constante, nunca loga valores).

| Variável | Onde | Protege | Ausente |
|---|---|---|---|
| `CRON_SECRET` (Worker) + `HARMONICS_CRON_SECRET` (GitHub Actions, mesmo valor) | `Authorization: Bearer` | `GET /api/automation/cron`, `GET/POST /api/cron/payment-reminders`, `POST /api/automation/contracts/unsigned-alerts` | 503 (cron) / só admin (rotas com fallback admin). Query string não é aceita. |
| `INTERNAL_API_KEY` (opcional) | header `x-internal-key` | caminho interno de `/api/automation/send`, `/api/contracts/{html-to-pdf,archive,internal/pdf}` | caminho interno desligado; essas rotas exigem admin |
| `INTERNAL_API_SECRET` (legado, opcional) | header `x-internal-api-secret` | caminho interno de `/api/automation/send` | idem |
| `AUTOMATION_CRON_SECRET` (legado, opcional) | header `x-automation-secret` | `unsigned-alerts` | só Bearer `CRON_SECRET` ou admin |
| `DEBUG_INTERNAL_KEY` | `?debugKey=` | `/api/debug/contracts/[token]/pdf` (também exige `ENABLE_DEBUG_ROUTES=true` + admin da plataforma) | rota fechada |
| `ASAAS_WEBHOOK_SECRET` | header `asaas-access-token` | `/api/webhooks/asaas` | 503 |

Segredos de saída (não protegem rota do app): `CONTRACT_SERVICE_API_KEY`, `HARMONICS_KEY_CONTRATO`,
`WHATSAPP_API_KEY`, `RESEND_API_KEY`, `ASAAS_API_KEY`, `GOOGLE_OAUTH_*`.

## Configurar/rotacionar o segredo do cron (sem parar as automações)
1. Gerar um valor aleatório (ex.: `openssl rand -hex 32`). Não colar em chat, issue ou commit.
2. GitHub → Settings → Secrets and variables → Actions → `HARMONICS_CRON_SECRET` = valor.
3. Cloudflare → Workers & Pages → `harmonics-app` → Settings → Variables and Secrets →
   `CRON_SECRET` (tipo **Secret**) = o mesmo valor.
4. Só então publicar o código fail-closed (com os dois configurados o cron continua rodando).
5. Validar: a próxima execução do workflow mostra `HTTP 200`; uma chamada sem Bearer recebe 401.
