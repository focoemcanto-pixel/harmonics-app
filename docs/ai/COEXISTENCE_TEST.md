# Teste de Coexistence — número atual (roteiro, requer aprovação)

Nada aqui foi executado. Os passos 3 em diante conectam o número à Cloud API e só podem
rodar com aprovação explícita do responsável. A IA continua desligada durante o teste.

## 1. Pré-requisitos externos (antes do dia do teste)
- [ ] App Meta (developers.facebook.com) com o produto WhatsApp e Business Manager verificado.
- [ ] Acesso ao Embedded Signup com Coexistence: o app precisa ser **Tech Provider** (ou usar um
      BSP/Solution Partner). Sem isso, o fluxo "conectar app WhatsApp Business existente" não aparece.
- [ ] País do número elegível no painel da Meta; app WhatsApp Business **≥ 2.24.17** no celular principal.
- [ ] Backup do WhatsApp Business feito no celular (Configurações → Conversas → Backup).
- [ ] Segredos no Worker de produção: `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
      `AI_CHANNEL_ENCRYPTION_KEY` (`openssl rand -base64 32`). **Não** definir `AI_INBOX_AI_ENABLED`.
- [ ] Webhook do app Meta: `https://app.bandaharmonics.com/api/webhooks/whatsapp-cloud`, campos
      `messages`, `smb_message_echoes`, `history`, `smb_app_state_sync`.

## 2. Impactos conhecidos para avisar a equipe
- Aparelhos vinculados (WhatsApp Web/Desktop) são desconectados no onboarding e podem ser re-vinculados.
- Throughput fixo de 20 msg/s; mensagens do app continuam grátis e fora da janela de 24h.
- Quem escreveu logo antes do onboarding só pode ser respondido via API por template (pelo app, normal).
- **WaSender será desvinculado**: ele usa uma sessão de aparelho vinculado e a Meta desvincula todos
  os vinculados no onboarding. Convites, lembretes e avisos de contrato param até re-escanear o QR do
  WaSender. Fazer o teste fora do horário do cron (12:05–21:05 UTC), re-vincular logo após o passo 3.1
  e confirmar com o WaSender que a sessão re-vinculada é estável com Coexistence ativa.

## 3. Execução (com aprovação)
1. Embedded Signup → "Conectar app WhatsApp Business" → escanear QR no celular → **aceitar compartilhar histórico**.
2. Anotar Phone Number ID e WABA ID; gerar token de System User com `whatsapp_business_messaging`
   e `whatsapp_business_management`.
3. Harmonics → `/inbox/configuracoes` → preencher IDs e token → **Verificar número / Coexistence**:
   esperado `App Business: sim (Coexistence)`.
4. Canal `Ativo`, modo **Observação**, IA desligada → Salvar.

## 4. Critérios de aceite (IA desligada)
- [ ] Mensagem de um número de teste aparece no Inbox em ≤ 5 s e conta como não lida.
- [ ] Resposta digitada no app Business aparece no Inbox como "App WhatsApp Business".
- [ ] Histórico importado (`Histórico: completed`) sem gerar não lidas.
- [ ] Resposta enviada pelo Inbox chega ao cliente e aparece no app Business.
- [ ] Um convite/lembrete WaSender de teste continua sendo entregue.
- [ ] Nenhuma mensagem automática enviada (`ai_usage_ledger` vazio).

## 5. Rollback
Canal `Pausado` em `/inbox/configuracoes` (o Inbox para de enviar; o número segue no app). Para
desfazer o vínculo com a Cloud API: Business Manager → WhatsApp → número → desconectar. O número
continua no app WhatsApp Business.
