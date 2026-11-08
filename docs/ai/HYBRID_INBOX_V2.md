# Harmonics AI — Inbox híbrido V2 (WhatsApp Cloud API + Coexistence)

Continua a fundação V1 (`HYBRID_INBOX_V1.md`). **Inerte por padrão**: sem as variáveis
abaixo e sem ativação explícita no workspace, nada é respondido nem enviado. WaSender,
convites, lembretes, contratos e pagamentos não foram alterados.

## Como funciona
```
Meta webhook ──(assinatura HMAC + dedupe)──► ai_ingest_message (RPC, 1 transação)
   │ messages            → conversa/mensagem do cliente (+ pendente p/ IA se owner=ai)
   │ smb_message_echoes  → mensagem da equipe no app Business ⇒ owner=human (takeover atômico)
   │ history             → histórico da Coexistence (sem acionar IA, sem "não lidas")
   │ statuses            → entregue/lida/falha + reconciliação de envios "unknown"
   ▼
IA (after() da resposta + cron) ─ claim da conversa ─ gate ─ LLM+ferramentas ─ ai_enqueue_ai_reply
   ▼                                                    (rejeita se dono/versão mudou)
ai_claim_outbox (FOR UPDATE SKIP LOCKED; revalida dono, versão, kill switch, canal) ─► Cloud API
   └─ ai_complete_outbox (sent/failed/unknown); lease vencido ⇒ unknown, nunca reenvio cego
```
- **Titularidade**: `owner` `ai|human` + `owner_version`. Assumir, responder pelo Inbox,
  aprovar rascunho ou responder pelo app Business ⇒ humano na hora e fila da IA cancelada.
  Devolver para IA: somente admin.
- **Pedido de humano / assunto sensível** (atendente, reclamação, cancelamento, desconto,
  alteração contratual, pagamento) ⇒ mensagem curta de transição + `needs_human`; a IA para.
- **IA**: PT-BR, 1–3 frases, uma pergunta por vez, se apresenta como assistente virtual na
  1ª resposta, memória (`lead_data`), áudio transcrito. Ferramentas lêem só o workspace:
  agenda (sem dados de terceiros), `pricing_settings` (sem defaults de código), formações/
  tipos de evento, cadastro do próprio número (eventos, orçamentos, status de contrato).
  Proposta/desconto/alteração ⇒ `ai_approvals`; aprovar proposta cria orçamento **rascunho**.
- **Modos** (por workspace): `observe` (padrão; só registra) → `draft` (IA sugere, equipe
  envia) → `auto`. Conversas novas só nascem com a IA fora do modo observação.
- **Inbox** `/inbox`: filtros (precisa de humano, não lidas, IA, equipe, encerradas), busca,
  histórico, rascunhos, aprovações, assumir/devolver/encerrar, notificações do navegador e
  contador no título. Tempo real por polling incremental (4s lista / 3s conversa).
  Config. admin: `/inbox/configuracoes` (canal, token criptografado, modo, limites, kill switch).

## Segurança e LGPD
- Tabelas `ai_*` com RLS e sem privilégios para `anon/authenticated`; RPCs só `service_role`;
  rotas com `guardWorkspaceMember/Admin` (workspace sempre da sessão). FKs compostas
  `(conversation_id, workspace_id)` impedem mistura entre tenants; `phone_number_id` único.
- Webhook falha fechado sem `META_APP_SECRET`; desafio GET com `META_WEBHOOK_VERIFY_TOKEN`.
- Token da Meta cifrado (AES-256-GCM) com `AI_CHANNEL_ENCRYPTION_KEY`; nunca retornado.
- Logs sem conteúdo de mensagem nem token. Retenção por workspace (`ai_purge_expired_data`,
  `GET /api/cron/ai-inbox?purge=1`) e exclusão do titular (`POST .../erase` com `EXCLUIR`).
- Custos: limites diário/mensal (US$) e de respostas/turnos ⇒ excedeu, vai para humano.
- **Kill switch**: `AI_INBOX_KILL_SWITCH=true` (global, barra geração e envio já reservado),
  `AI_INBOX_AI_ENABLED` (liberação global, padrão desligado), `ai_enabled` por workspace
  (checado também dentro do claim no banco) e botão "Desligar IA agora".

## Variáveis (Worker)
`META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `AI_CHANNEL_ENCRYPTION_KEY` (32 bytes base64:
`openssl rand -base64 32`), `OPENAI_API_KEY` (já usado no app), `AI_INBOX_AI_ENABLED`,
`AI_INBOX_KILL_SWITCH`, opcionais `AI_INBOX_MODEL` (padrão `gpt-4.1-mini`),
`AI_INBOX_TRANSCRIBE_MODEL`, `AI_INBOX_DEBOUNCE_MS`, `META_GRAPH_VERSION`. Inbox: visível e acessível
apenas para owner/admin (módulo `usuarios`) nesta fase.

## Ativação (requer autorização do responsável)
1. Aplicar migrations `20261107150000_*v1` e `20261108120000_*v2` (aditivas).
2. **Coexistence** (requisitos Meta): app WhatsApp Business ≥ 2.24.17; onboarding por
   Embedded Signup de um **Tech Provider/Solution Partner** (app Meta próprio verificado ou
   BSP); confirmar país elegível no painel Meta; companion apps são desvinculados no
   onboarding e podem ser re-vinculados; throughput fixo de 20 msg/s; aceitar o
   compartilhamento de histórico no onboarding; contatos que escreveram logo antes do
   onboarding só recebem template. Mensagens do app continuam grátis e fora da janela de 24h.
3. Webhook na Meta: `https://<app>/api/webhooks/whatsapp-cloud`, campos `messages`,
   `smb_message_echoes`, `history`, `smb_app_state_sync`.
4. `/inbox/configuracoes`: Phone Number ID, WABA ID, token → "Verificar número/Coexistence"
   → canal `Ativo` com modo `observe` por alguns dias → `draft` → `auto` em piloto.
5. Agendar `GET /api/cron/ai-inbox` (Bearer `CRON_SECRET`) a cada 1–5 min como garantia
   (o Cron Trigger atual do Worker roda de hora em hora e não foi alterado).

## Rollback
`AI_INBOX_KILL_SWITCH=true` (imediato) ou canal `Pausado`/IA desligada no workspace. O
número continua funcionando no app Business. Reverter o código remove apenas rotas novas;
tabelas `ai_*` podem permanecer (dados preservados para revisão).

## Testes
- `npm test` (inclui `tests/ai/*`: webhook, assinatura, parsing Coexistence, cripto, gate,
  gatilhos de handoff, prompt, ferramentas sem invenção, LLM, limites).
- `./supabase/local/run-ai-inbox.sh` (Postgres 16 local, schema de produção sem dados):
  dedupe, takeover por eco, eco da própria API, corrida geração×takeover, versão obsoleta,
  4 workers × 20 mensagens sem duplicar, gerações paralelas, kill switch global/workspace,
  rascunho, isolamento entre workspaces, janela 24h, reconciliação, histórico, LGPD.
