# Redesenho do fluxo de contratos (sem Render/GAS)

## 1) Fluxo atual (diagnóstico)

### 1.1 Geração de contrato final
Hoje, o app já gera contrato final no backend principal via `POST /api/contracts/generate`:

1. Valida variáveis de ambiente (`CONTRACT_TEMPLATE_DOC_ID`, `CONTRACTS_DRIVE_FOLDER_ID`, credenciais Supabase).  
2. Carrega contexto (`contracts`, `precontracts`, `contacts`, `events`) no Supabase.  
3. Monta `templateData` com `buildContractTemplateData`.  
4. Copia o template no Google Docs/Drive, processa blocos condicionais, aplica placeholders, exporta PDF e salva no Drive.  
5. Atualiza `contracts.doc_url` e `contracts.pdf_url`.

Referências:
- `app/api/contracts/generate/route.js`
- `lib/contracts/buildContractTemplateData.js`
- `lib/contracts/googleContractGenerator.js`

### 1.2 Preview de contrato (gargalo atual)
A rota `GET /api/contracts/preview/[token]` ainda depende de Apps Script externo (`HARMONICS_CONTRATO_GAS_EXEC_URL`) para gerar PDF de prévia.

Isso cria uma arquitetura híbrida (parte no app, parte fora) e aumenta:
- complexidade operacional,
- pontos de falha,
- dificuldade de observabilidade,
- risco de divergência entre preview e contrato final.

Referência:
- `app/api/contracts/preview/[token]/route.js`

### 1.3 Preview HTML já no app
Já existe `GET /api/contracts/preview-html/[token]`, que monta preview local (sem GAS) via `buildContractPreviewHtml`.

Referência:
- `app/api/contracts/preview-html/[token]/route.js`

---

## 2) Objetivo do novo desenho

Centralizar **100% do pipeline de contratos no backend do app principal**, eliminando Render/GAS no caminho crítico.

### Princípios
- uma única fonte de verdade para merge de dados e placeholders;
- preview e contrato final usando a mesma base de templateData;
- idempotência para evitar contratos duplicados;
- rastreabilidade ponta-a-ponta por `traceId`;
- segurança por least-privilege e secrets server-side.

---

## 3) Nova arquitetura proposta

## 3.1 Camada de serviço (lib/contracts/service)
Criar serviços explícitos:

- `ContractContextService`  
  Resolve dados de `contract/precontract/contact/event`.

- `ContractTemplateService`  
  Gera `templateData` normalizado e validado.

- `DriveContractService`  
  Responsável por cópia do template, substituições, export PDF e organização em pasta.

- `ContractPersistenceService`  
  Atualiza estado no banco (`contracts`, logs, retries, versionamento).

- `ContractOrchestrator`  
  Orquestra caso de uso: `preview`, `generate`, `regenerate`, `sync`.

## 3.2 Endpoints do backend

- `POST /api/contracts/preview`  
  Entrada: `{ precontractId | contractId }`  
  Saída: URL assinada/temporária para PDF (ou binário inline), sem GAS.

- `POST /api/contracts/generate`  
  Entrada: `{ precontractId | contractId, mode?: 'draft'|'final' }`  
  Saída: `docUrl`, `pdfUrl`, metadados de pasta/versão.

- `POST /api/contracts/regenerate`  
  Força nova versão (ex.: `v2`, `v3`) preservando histórico.

- `GET /api/contracts/status/:id`  
  Estado da pipeline para UI e observabilidade.

## 3.3 Modelo de estado (sugestão)
Adicionar campos em `contracts` (ou tabela `contract_jobs`):

- `generation_status`: `pending | generating | ready | failed`
- `generation_error`: texto último erro
- `generation_attempts`: contador
- `last_generated_at`
- `drive_doc_id`, `drive_pdf_id`, `drive_folder_path`
- `template_version`
- `idempotency_key`

Isso permite retries seguros e diagnóstico rápido.

---

## 4) Estratégia de geração (sem Render)

1. API recebe `precontractId/contractId`.  
2. Backend valida authz (admin ou token do cliente válido para aquele contrato).  
3. Busca contexto e valida consistência mínima dos dados.  
4. Gera `templateData` único.  
5. Determina estrutura de pasta (ano/mês + opcional cliente/evento).  
6. Executa geração no Google Docs/Drive.  
7. Persiste URLs/IDs/estado no Supabase.  
8. Retorna payload para UI.

### Idempotência
Usar `idempotency_key = hash(precontractId + template_version + payload_signature)`. Se já existir execução pronta com mesma chave, apenas retorna artefatos existentes.

---

## 5) Exportação para pasta do Google Drive

## 5.1 Variáveis de ambiente
Obrigatórias:

- `CONTRACT_TEMPLATE_DOC_ID`: ID do Google Doc template base.
- `CONTRACTS_DRIVE_FOLDER_ID`: pasta raiz de contratos.
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_OAUTH_REFRESH_TOKEN`

Opcionais recomendadas:

- `CONTRACTS_DRIVE_SUBFOLDER_MODE=year_month` (`year_month` | `flat` | `year_month_client`)
- `CONTRACT_PDF_EXPORT_ENABLED=true`
- `CONTRACT_TEMPLATE_VERSION=v1`

## 5.2 Convenção de pastas/arquivo
Padrão sugerido:

- Raiz: `CONTRACTS_DRIVE_FOLDER_ID`
- Ano: `YYYY`
- Mês: `MM - Nome`
- Arquivo doc: `Contrato - <Cliente> - <YYYY-MM-DD> - vN`
- Arquivo pdf: `Contrato - <Cliente> - <YYYY-MM-DD> - vN.pdf`

Com isso, busca manual e auditoria ficam previsíveis.

---

## 6) Segurança e autenticação

## 6.1 Princípios
- Segredos somente server-side (nunca `NEXT_PUBLIC_*`).
- Service role do Supabase apenas no backend.
- OAuth refresh token com rotação periódica.
- Escopos mínimos no Google (`drive.file` preferível, avaliar necessidade de `drive`).
- Logs sem PII sensível.

## 6.2 Hardening recomendado
- Validar sessão/perfil antes de gerar/exportar.
- Rate limit por usuário/contrato.
- Auditoria por tabela `contract_audit_logs`.
- Chaves em cofre (Render removido, manter em provider de secrets do host atual).
- Alertas para falha repetida de geração.

---

## 7) Plano de migração sem downtime

## Fase 1 — Preparação
- Extrair lógica atual para serviços reutilizáveis.
- Adicionar métricas e logs estruturados (`traceId`, `contractId`, `precontractId`).

## Fase 2 — Preview local definitivo
- Implementar `POST /api/contracts/preview` usando o mesmo serviço de geração (modo preview).
- Alterar UI para usar nova rota.
- Manter rota antiga com feature flag por período curto.

## Fase 3 — Desligar dependência externa
- Remover `HARMONICS_CONTRATO_GAS_EXEC_URL` e chamadas externas de preview.
- Documentar rollback (flag para fallback temporário, com prazo de expiração).

## Fase 4 — Otimização
- Idempotência, retries com backoff, fila assíncrona opcional para picos.
- Dashboards de sucesso/erro/latência.

---

## 8) Melhorias de eficiência recomendadas

- Reuso de contexto: evitar múltiplas queries redundantes por etapa.
- Cache curto de metadata de pastas do Drive (em memória/kv) para reduzir `files.list`.
- Batch updates no Docs já existentes (manter padrão).
- Fila assíncrona para geração pesada (BullMQ/pg-boss) com retorno imediato de jobId.
- Normalizar erros do Google em códigos internos (`DRIVE_AUTH_ERROR`, `TEMPLATE_NOT_FOUND`, etc.).

---

## 9) Ações concretas no código atual

1. **Eliminar dependência de GAS** no preview:
   - substituir implementação de `app/api/contracts/preview/[token]/route.js` para usar `ContractOrchestrator` local.
2. **Unificar fonte de templateData**:
   - garantir que preview e final usem `buildContractTemplateData` + mesmos normalizadores.
3. **Adicionar idempotência e status** em persistência de contrato.
4. **Fortalecer validação de env** em startup/check de health.
5. **Atualizar `.env.example`** com todas variáveis obrigatórias de contratos/Google OAuth.

---

## 10) Resultado esperado

Após o redesenho, o processo de contrato fica:

- 100% no app principal (sem Render/GAS);
- mais simples de operar;
- com segurança e rastreabilidade melhores;
- com menor risco de divergência entre preview e PDF final;
- pronto para escalar com fila e retries controlados.
