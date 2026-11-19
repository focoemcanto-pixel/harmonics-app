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


## 6. Gate adicional — piloto Nara V2 com atendimento real

**Não confundir deploy do Worker com ativação da IA.** O canal de teste Meta (`+1 555…`) não é o número comercial. Uma verificação bem-sucedida da Cloud API desse número **não confirma Coexistência** do WhatsApp Business real.

1. Vincular o número comercial existente via Embedded Signup com fluxo específico de Coexistência; preservar o aplicativo Business; re-vincular e testar WaSender (onboarding pode desconectar dispositivos).
2. Consultar o número real via `POST /api/ai/channel/eligibility` no dashboard autenticado. Exigir `ok=true` e `isOnBizApp=true` para este piloto, sem confiar em toggles editáveis, e revalidar em até 24 horas da ativação.
3. Manter canal em `observe` e IA desligada até receber **mensagem real** de um contato de teste, **eco real** de resposta pelo app Business e retorno da titularidade `human` com descarte de respostas pendentes. Testar manualmente o botão “Devolver para IA” em conversa de teste.
4. **Nara V2 atualmente é simulador-only** (`runNaraV2(... simulated:false)` rejeita com `nara_v2_simulator_only`), enquanto o atendimento real usa `runCommercialTurn`. Antes de ativar `auto`, implementar/adaptar uma rota V2 para produção, preservando gate, dedupe, outbox, versões, limites, aprovação e testes locais. Não habilitar o motor antigo por engano.
5. Só depois dos cenários ponta a ponta, começar por poucos contatos e limites de custo/respostas/turnos conservadores. O usuário pode assumir pelo WhatsApp Business; a Nara só recupera conversa pela ação administrativa no Inbox.
6. Links, propostas, contratos, descontos e movimentos financeiros sensíveis seguem sob aprovação; comprovantes entram no status informado/em análise, sem gerar crédito bancário sem conciliação.
7. Verificar com evidências operacionais que `AI_INBOX_AI_ENABLED`, kill switch, `ai_workspace_settings`, canal e geração de resposta estão consistentes. O botão “Desligar IA agora” e o status “Pausado” devem interromper o fluxo no teste de rollback.

**Este roteiro não ativa o número nem o motor.** O cadastro do WhatsApp existente exige a ação autenticada de onboarding Meta e aceite no aparelho do titular; não simular Coexistência alterando o valor da coluna.

## 7. Segurança ao trocar Phone Number ID, WABA ou token

A PR #841 inclui um gate de identidade obrigatório no backend:

- Salvar um Phone Number ID, WABA, número exibido diferente ou novo token **invalida** `last_eligibility`, define `coexistence=false`, reseta histórico de diagnóstico/webhook e força `status='paused'`. Novo canal também nasce pausado.
- O botão "Verificar número / Coexistence" somente consulta as credenciais já **salvas**; alterações não salvas no formulário precisam ser persistidas primeiro.
- As rotas de salvamento e diagnóstico usam atualização condicional pela revisão `updated_at` (compare-and-swap). Se uma consulta Meta começou antes de salvar outro número/token e termina depois, sua tentativa de persistir o diagnóstico antigo retorna **409**, sem escrever sobre o número novo.
- Caso uma configuração seja alterada em outra sessão, o salvamento também retorna **409**. Recarregar o painel e repetir a verificação no número realmente conectado.
- Cobertura de regressão: `tests/ai/channel-identity.test.mjs` (identidade, token, consultas concorrentes, troca de credenciais em voo e isolamento de workspace).

Estes gates não substituem o QR/Embedded Signup nem comprovam que o número comercial foi conectado; não ativar IA até passar no roteiro real.
