# Nara — WhatsApp → comprovantes → financeiro (fase 1)

## Regra financeira aprovada

A Nara pode confiar no comprovante recebido para registrar **pagamento informado** e apresentar o saldo comercial restante. Apenas o fluxo de caixa/Plug faz a conciliação com o banco. **Pagamento informado não é entrada bancária confirmada.**

No Harmonics atual, `op_finance_ledger(kind='receipt')` compõe o caixa real e alimenta a ponte assinada para o financeiro externo. Assim, comprovantes não conciliados **nunca** devem ser gravados diretamente nesse ledger, nem confirmados na tabela legada `payments` sem uma decisão explícita da integração financeira. Isso evita antecipação de caixa, duplicação na ponte e distorção de saldo.

## O que esta PR implementa

- `ai_payment_evidence`: registro de mídia candidata, com integridade de workspace e fonte, revisão de estado, controle de duplicidade por mensagem e digest opcional, RLS sem acesso anônimo/autenticado.
- `isIncomingProofMedia`: detecta fotos PNG/JPEG/WebP e documentos PDF **novos de clientes**; ignora mídia de histórico, ecos do app, vídeos e formatos não permitidos.
- `stagePaymentEvidence`: persiste o candidato com idempotência mesmo em reentrega de webhook após falha parcial. Usa IDs já persistidos pelo `ai_ingest_message`.
- Hook no endpoint existente `/api/webhooks/whatsapp-cloud`, **desligado por padrão** via `NARA_PAYMENT_EVIDENCE_CAPTURE_ENABLED`.
- `reportedPaymentSummary` (cálculo puro): saldos comercial informado vs caixa registrado, exclusão de comprovante já conciliado, prevenção de dupla contagem por ID e alerta de excesso de pagamento.
- Testes unitários totalmente sintéticos.

**Não faz nesta fase:** download de arquivo, extração por visão/OCR, reconhecimento de Pix, vínculo automático a evento/parcela, criação de recebimento, atualização de UI/CRM, confirmação bancária, envio de WhatsApp, deploy ou ativação do número.

A categoria inicial `candidate` **não significa que a mídia seja comprovante**, só que pode ser analisada depois. O campo `status='matched'` exige evento e valor; o banco exige referência explícita para `reconciled`. Não mudar status por regex de conversa ou somente por aparência do documento.

## Sequência segura para ativação futura

1. Verificar elegibilidade Coexistence e configurar webhook oficial, com assinatura HMAC validada, mantendo IA de envio desligada.
2. Aplicar migration em **staging**, rodar testes SQL e suíte de Node; validar que tabela/índices e permissões estão corretos.
3. Habilitar a variável de CAPTURA somente no ambiente de testes. Reenviar fixtures sintéticas assinadas e verificar inserção única; simular falha entre RPC de mensagem e gravação de candidato e confirmar replay idempotente.
4. Implementar processamento assíncrono por fila da mídia: baixar com token oficial já armazenado, conferir MIME real/tamanho/expiração, extrair campos via provedor aprovado, criptografar ou armazenar em bucket privado com retenção, e registrar falhas sem conteúdo sensível em log.
5. Vincular exclusivamente por combinação verificada de telefone/contato, workspace, evento, parcela e valor; casos ambíguos vão para revisão humana. Um comprovante encaminhado, agendado, repetido ou divergente não deve produzir duas cobranças/baixas.
6. Publicar uma projeção comercial separada de `op_finance_ledger`, incluindo `total_informado`, `saldo_por_comprovantes`, `recebido_confirmado`, `saldo_confirmado`, e evidência de origem.
7. Definir contrato versionado com o fluxo de caixa/Plug para receber o lançamento **informado** e devolver `conciliado` ou `não_localizado` com referência da transação. Não usar a ação existente `finance-bridge receipt` para publicar comprovante não conciliado, pois ela escreve caixa operacional.
8. Só depois de testes ponta a ponta e autorização operacional, habilitar captura no número real. **Não** habilitar respostas automáticas da Nara.

## Critérios obrigatórios antes de considerar concluído

- Prova de acesso oficial ao número (não automação de WhatsApp Web).
- Foto/PDF real no ambiente autorizado → extração correta com conferência de valor/data/identificador.
- Atribuição exata ou revisão humana; nunca associação pelo nome isolado.
- Parcelas múltiplas e pagamento parcial; comprovante duplicado com mesmo ID e mesmo arquivo.
- Resiliência a webhook repetido, desconexão, media ID expirado e falhas da IA.
- Diferença entre saldos informados e bancários no painel.
- Confirmação do Plug sem atualizar duas vezes o caixa; valor ausente no banco preserva comprovante e sinaliza divergência.
- Privacidade: controle por workspace, auditoria, retenção, sem PII de clientes em fixtures/repositório público.

## Operação nesta PR

A variável `NARA_PAYMENT_EVIDENCE_CAPTURE_ENABLED` é propositalmente **ausente/desligada**. A migration proposta não deve ser aplicada diretamente em produção sem staging e backup. O código não cria mensagens de saída. O status do número e o estado de deploy não foram validados pela PR.

## Regra adicional: painel do cliente e WhatsApp são a MESMA entrada

Auditado em `app/api/cliente/pagamentos/route.js` e `app/cliente/[token]/page.js`:

- O painel do cliente atualmente envia `multipart/form-data` a `/api/cliente/pagamentos`, salva o anexo no bucket privado `payment-proofs`, cria a linha `payments` com status `em_analise`, e a aba Financeiro mostra o histórico `payments` com arquivo e data.
- **Nara não deve criar uma segunda tabela comercial de pagamentos.** `ai_payment_evidence` é somente fila de evidências de WhatsApp; a linha definitiva, quando validada, deve usar a mesma `payments` que o painel já lê. A chave de origem precisa vincular `ai_payment_evidence.message_id` ao `payments.id`.
- A Nara deve comparar evento/contato vinculado, parcela, valor em centavos, data do comprovante, forma de pagamento e, quando houver, identificador da transação ou digest SHA-256. Deve consultar `payments` existentes antes de criar outro.
- Se o pagamento do cliente já tem a mesma fonte/arquivo, **não criar outro**. Se há UM pagamento existente com evento, valor, data e forma coincidentes, mas sem arquivo, anexar ao mesmo `payments.id`. Se já existe arquivo sem verificação de igualdade, ou há mais de um pagamento compatível, sinalizar `needs_review` e não lançar automaticamente. Sem candidato correspondente e com vínculo inequívoco, inserir pagamento `em_analise` com o arquivo.
- Documento do WhatsApp deve usar exatamente o mesmo armazenamento privado e o mesmo mecanismo de visualização com URL assinada utilizado pelo painel do cliente. Não usar token público do cliente como credencial da Nara; usar operação de servidor autorizada e restrita ao workspace.
- O cliente verá a mesma linha com origem "Enviado por WhatsApp — registrado pela Nara", data do pagamento, valor, comprovante e estado "Pagamento informado / aguardando conciliação". Somente a confirmação financeira independente mudará para "Confirmado".
- **Não fazer um segundo lançamento independente** em `op_finance_ledger`: a bridge financeira lê recibos reais dali, e o gatilho existente só deve recebê-los quando a confirmação estiver concluída.

### Inconsistência já encontrada para corrigir antes da automação

O endpoint atual `/api/cliente/pagamentos` **incrementa manualmente** `events.paid_amount` e reduz `events.open_amount` mesmo quando registra `payments.status='em_analise'`. Já `lib/finance/event-finance.js` considera como recebido somente pagamentos confirmados; a página do cliente também usa fallback para o snapshot do evento. Assim o valor exibido pode depender da rota que o atualizou.

Antes do lançamento de comprovantes pela Nara, criar projeção canônica para **valor informado** (incluindo `em_analise`) e **valor confirmado** (somente baixa conciliada), consistente na tela do cliente, no dashboard e no fluxo de caixa. Revisar/testar a rota do cliente para que não marque caixa confirmado por `em_analise`. Não alterar contratos ou pagamentos históricos.

### Implementado nesta extensão

`lib/ai/inbox/payment-submission-plan.mjs` é uma **decisão pura sem escrita**, com os estados `already_registered`, `attach_existing`, `create_pending` e `needs_review`. A função evita cadastrar duas vezes um pagamento já reconhecido e rejeita casos ambíguos. Ainda faltam processamento de mídia, hash efetivo, execução transacional da operação na tabela `payments` e atualização da interface.

### Aceite ponta a ponta futuro

1. Cliente envia comprovante no painel; a Nara recebe o mesmo pelo WhatsApp e não duplica valor/anexo.
2. Cliente apenas envia WhatsApp; Nara faz o upload privado, cria pagamento `em_analise` e ambos os painéis exibem o mesmo item/arquivo com data real.
3. Cliente já inseriu o pagamento sem arquivo; Nara apenas anexa e preserva `payments.id`.
4. Pagamentos múltiplos/parciais no mesmo evento, dois comprovantes com mesmo valor e mesmo dia, comprovantes reenviados e hashes repetidos.
5. Fluxo de caixa/Plug confirma ou contesta, sem crédito bancário antecipado e sem duplicidade da ponte.
