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
