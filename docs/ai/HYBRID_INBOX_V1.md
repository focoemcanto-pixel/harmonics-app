# Harmonics AI — híbrido V1 (fundação, desativada)

> Continuação implementada em `HYBRID_INBOX_V2.md` (webhook, Inbox, IA, fila transacional).

## Estado desta branch
Escopo aditivo e **inerte**: sem webhooks ativos, sem novo provedor,
sem migração aplicada, sem mensagens enviadas e sem deploy.

- `ai_conversations`: vinculação ao workspace e titularidade `human|ai`,
  com `ai_enabled=false` e `owner=human` por padrão.
- `ai_messages`: armazenamento de mensagens com ID externo para deduplicação.
- `ai_message_outbox`: intenções de envio, *não* envia mensagens.
- `ai_handoffs`: histórico auditável de troca de responsável.
- `ai_switch_conversation_owner`: RPC transacional que bloqueia conversa
  com `FOR UPDATE`, incrementa `owner_version` e cancela intenções pendentes.
- RLS ativo e privilégios revogados de `anon` e `authenticated`, sem
  políticas públicas; acesso somente por backend autorizado.

## Requisitos antes de produção
1. Validar esquema e privilégios no Supabase staging, incluindo migrations
   anteriores; verificar que `service_role` é exclusivamente servidor.
2. Construir endpoints de Inbox com `guardWorkspaceMember/Admin`, leitura
   paginada, ingestão autenticada e transição com ator auditável.
3. Validar webhook da Meta (desafio, assinatura, origem), repetição de eventos,
   identidade da mensagem, consentimento, janela de 24h e templates.
4. Implementar mapeamento de canal/contato *por workspace*, sem fallback
   para credenciais legadas de outro tenant.
5. Implementar fila com **reserva de despacho atômica** e cancelamento/
   reconciliação de itens `dispatching`: verificação JS isolada não elimina
   a corrida entre consulta e chamada externa. Em caso de timeout externo,
   marcar `unknown` e reconciliar antes de reenvio.
6. Detectar `smb_message_echoes` genuínos da Business App, distinguir ecos
   de envios da API e atribuir atendimento humano de forma transacional.
7. Construir painel e modo observação antes de gerar respostas automáticas.
8. Confirmar elegibilidade da coexistência e procedimentos de backup/histórico
   para o número atual; **não desconectar nem registrar número sem aprovação**.
9. Validar exclusão/retenção de dados e LGPD, isolamento RLS, telemetria,
   custos e kill switch; aprovar antes de qualquer ativação.
10. Executar `node --test tests/ai/hybrid-ownership.test.mjs` e testes
    de concorrência reais no staging.

## Rollback
Como não há ativação, rollback de código = fechar PR/reverter commits.
Se uma migration for aplicada posteriormente, preferir desativar o recurso
e preservar os dados para revisão; remoção de tabelas exige backup,
plano de retenção e autorização expressa.

## Integração atual que deve permanecer intacta
`lib/whatsapp/send-whatsapp-message.js` usa provider configurável com
caminho legado WaSender e regras de workspace. Esta branch não altera o envio
convencional, convites, lembretes nem notificações de contrato.
