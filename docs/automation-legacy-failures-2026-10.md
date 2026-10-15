# Falhas legadas da Central de Automação — diagnóstico (2026-10-15)

Workspace Harmonics: `f36dcd9b-22a9-487a-bf2e-691d17bd6294` (key `default`).
As três falhas abaixo já existiam antes do PR #735. Consultas feitas só em leitura no banco de produção.

## 1. WaSender HTTP 429 (account protection)

**Evidência** (`automation_logs`, status `failed`):

| Quando (UTC) | Regra | Erro |
| --- | --- | --- |
| 2026-09-11 16:04:33 | repertoire_pending_15_days_client | 429 — "You can only send 1 message every 5 seconds." |
| 2026-10-09 18:06:24 | payment_pending_2_days_client | 429 — mesmo texto |

Nos dois casos houve um envio `sent` 1,2 s / 1,7 s antes (16:04:32 e 18:06:22), na mesma execução do cron.

**Causa raiz.** O cron (`.github/workflows/harmonics-scheduled-automations.yml`, de hora em hora das 09:05 às 18:05 BRT)
chama `/api/automation/cron`, que percorre regras → candidatos → `executeAutomationEvent` → `sendWhatsAppMessage`
em série e **sem nenhum intervalo** entre envios. A conta WaSender tem "account protection" (1 mensagem a cada 5 s), então o
segundo envio de uma mesma execução era recusado. Volume histórico: no máximo 2 envios por execução.

**Correção** (`lib/whatsapp/provider-throttle.js`, usada em `sendWhatsAppMessage`):
- envios para a mesma conta/canal WaSender são espaçados por `WASENDER_MIN_SEND_INTERVAL_MS` (padrão 5500 ms);
- um 429/"account protection" é repetido **uma única vez** após a espera pedida (`Retry-After` ou "every N seconds", máx. 15 s).
  É seguro: o 429 significa que a mensagem não foi aceita, então não há envio duplicado.
- Providers diferentes de WaSender não mudam. O curl do cron tem `--max-time 120`, suficiente para ~20 envios espaçados.

## 2. WaSender HTTP 422 — "The provided JID does not exist on WhatsApp"

**Evidência:** 3 falhas, **todas para o mesmo número** (11 dígitos, DDD 71, celular com 9): 2026-09-25 16:48 e 20:18
(repertório 15 dias) e 2026-10-08 18:35 (quitação 2 dias).

**Causa raiz.** Não é problema de normalização: o motor envia o número só com dígitos (`cleanPhone`), DDD + número, sem 55,
e é assim que todos os 78 envios `sent` do histórico (10 e 11 dígitos) funcionaram — a WaSender completa o país.
O número em questão é bem formado, mas não tem WhatsApp (ou está errado no cadastro). Como o motor não guardava essa
informação, cada execução que tornava o evento elegível chamava o provider de novo e gerava um novo `failed`.
Grupos não são afetados: o destinatário sempre passa por `replace(/\D/g, '')`, então nunca é um JID de grupo.

**Correção** (`lib/automation/recipient-guard.js`, chamada em `executeAutomationEvent` antes do envio):
- valida o formato (DDD+número com 10/11 dígitos ou 55+DDD+número; DDD sem 0; 11 dígitos começa com 9);
- se o mesmo número teve falha `failed` com "JID does not exist" nos últimos 30 dias no workspace, não chama o provider;
- nos dois casos grava `automation_logs.status = 'skipped'` com `error_message` explicando o motivo e
  `metadata.skipReason` (`recipient_invalid_format` / `recipient_not_on_whatsapp`).
- O número enviado ao provider **não muda**. Os 78 números `sent` do histórico passam na validação.
- Erro ao consultar o banco não bloqueia o envio. Os `skipped` não renovam a janela: após 30 dias o número é tentado de novo.

Ação manual sugerida: corrigir o telefone desse cliente no cadastro (pré-contrato/contato) — a Central mostra o motivo no log.

## 3. Regra ativa com `template_id` NULL

**Regra:** `847c0e98-b6b4-43c9-afb5-98cd6ec23070` — key `lembrete_repertorio_rapido`, "Lembrete de repertório",
`repertoire_pending_15_days_client`, `days_before = 15`, `send_time = 09:00`, ativa, criada em 2026-05-02, editada em 2026-07-16.

**Causa raiz.** Não é um default de `lib/automation/ensure-defaults.js` (os defaults usam keys `*_auto`, sempre recebem o
`template_id` do upsert e nenhum deles é de repertório pendente). Ela foi criada pelo atalho "Lembrete de repertório" da tela
de Regras (`components/automacoes/RegrasPageClient.js`), onde o template é opcional. Não existe nenhum template de
"repertório pendente" no workspace.

**Impacto atual.** Nenhuma falha: com `template_id` NULL, `resolveMessage` usa a mensagem fixa de fallback
("Olá, {cliente}! Faltam 15 dias para o seu evento (...). Por favor, acesse o painel e finalize a escolha do repertório: {link}"),
e essa regra enviou 6 mensagens com sucesso entre 2026-09-11 e 2026-10-09. As falhas que aparecem nela são as dos itens 1 e 2.

**Opções (aguardando confirmação do dono; nada foi alterado em produção):**
1. Manter como está (a mensagem de fallback continua sendo enviada).
2. Criar um template "Lembrete de repertório" em `message_templates` com o texto desejado e vinculá-lo à regra
   (mesmo texto do fallback = sem mudança para o cliente, mas editável na Central).
3. Desativar a regra (o lembrete de 15 dias deixa de ser enviado).

## Legado conhecido, fora deste PR

- Inserts em `automation_logs` violando `automation_logs_event_id_fkey` (eventos excluídos).
- Consultas de fallback a colunas inexistentes (`profiles.is_admin`, `workspace_settings.admin_whatsapp_phone`,
  `events/precontracts.formation_text`).
