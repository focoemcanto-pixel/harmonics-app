# Serviços e revisões — auditoria de 20/10/2026

## Arquitetura encontrada

- `precontracts` é a origem comercial e do token público; `contracts.precontract_id` liga o documento à mesma negociação. `event_id` / `contact_id` ligam a operação existente.
- Formação/instrumentos principais e `reception_formation`, `reception_instruments`, `reception_hours` já existem em pré-contratos e eventos. A UI contém inclusive controles duplicados de receptivo. Não há tabelas de serviços genéricos ou revisões/versões no schema consultado.
- Som, transporte, receptivo e antesala são flags/preços/campos específicos, não uma entidade reutilizável de serviços.
- `contract_adjustment_requests` registra solicitações textuais, não versões assinadas. Reutilizá-la como documento seria misturar entidades diferentes.
- Templates e personalização individual são resolvidos pelo resolver corrigido na PR #773. `buildContractTemplateData` e o renderer são compartilhados nas prévias e geração.
- Assinatura inicial cria/atualiza contato e evento, chama geração, grava HTML/hash/metadados em `contracts` e pode acionar automações. Reexecutar esse fluxo para uma revisão seria inseguro.
- `internalPdfFlow` fazia upload com upsert em caminho fixo. Revisões exigem arquivos únicos; evidência anterior jamais pode ser substituída.
- Pagamentos são entidades próprias (`payments`, operação financeira). `createPaymentScheduleForPrecontract` evita recriar quando já há pagamentos, mas revisão não deve sequer chamar essa rotina.
- `quotes` guarda a proposta e seus campos legados de preço/receptivo; `event_types` define categoria/template. `event_role_slots` e `assignments` representam vagas/funções e pessoas, sem duração/tipo/condições contratuais de um serviço. Nenhuma dessas entidades já representa a coleção comercial solicitada.
- Escala é `event_musicians` / convites: papel por músico no evento. Formação de serviço não é escala nem confirmação de presença e não deve criar músicos automaticamente.

## Menor modelo consistente

1. `precontracts.service_specs` JSONB opcional com ID estável, tipo/rótulo, formação, funções, duração em minutos, notas. Uma única coleção comercial; nenhum espelho de serviços em outra tabela. NULL lê campos legados; novos registros estruturados geram projeções nos campos legados para consumidores antigos. Evento/membros consultam a mesma coleção pelo `event_id` existente.
2. `contract_revisions` é histórico do mesmo `contracts.id`, não um segundo contrato. Inclui snapshot comercial, formulário já preenchido, fonte congelada, HTML exibido, diff, versão base e evidência assinada. Uma revisão pendente por contrato. Sem alterações nos IDs existentes ou backfill destrutivo.
3. Ao criar a primeira revisão de um assinado antigo, capturar sua linha completa, HTML/PDF/hash/metadados como versão 1. Documento assinado é imutável por trigger. PDF antigo fica no caminho original e novos uploads usam caminhos únicos.
4. Revisão publicada congela a proposta. Versão anterior segue vigente, status do contrato principal continua assinado. Token novo identifica a revisão; link original continua representando o contrato vigente. Não reaproveitar aceite anterior: nova confirmação obrigatória.
5. Nova assinatura gera PDF antes de promover. RPC com locks verifica versão base, aplica atualização ao MESMO pré-contrato e evento, atualiza contrato e completa histórico atomicamente. Falha de PDF/transação deixa versão anterior vigente. Cancelamento de revisão não altera o vigente.
6. Pagamentos e parcelas não são inseridos, apagados ou reprocessados. Pago é preservado, saldo operacional usa novo valor menos o pago existente. Alteração de preço sinaliza conferência financeira. Não há cobrança/disparo automático em revisão.

## Interfaces e compatibilidade

- Pré-contratos: adesão explícita ao editor de serviços, aproveitando dados legados. Contratos: revisar/histórico. Evento: mesma ação e resumo de serviços. Escala/membros: informações por serviço, sem confundir com alocação individual.
- Contrato: `{{services_text}}` / `{{SERVICOS_CONTRATADOS}}`; quando template legado não possui o placeholder, seção de serviços é acrescentada somente se há coleção estruturada. Sem coleção, renderização antiga é mantida.
- Revisão: dados atuais preenchidos; mudanças; prévia integral; publicar e copiar link. Nenhuma mensagem enviada automaticamente.
- Assinatura/PDF de revisão usam HTML congelado no servidor. Histórico/validação/arquivos podem localizar versões assinadas anteriores por token. Links legados de PDF permanecem válidos.

## Decisões financeiras ainda manuais

Após mudança de valor assinada: ajustar parcela de saldo existente; registrar diferença em nova obrigação; ou redistribuir o saldo. Essas opções precisam de escolha explícita e tratamento de vencimentos/estornos. Nenhuma foi automatizada nesta implementação. Redução abaixo do pago gera saldo restante zero; eventual crédito/devolução exige conferência manual, sem estorno automático.

## Validação realizada antes da publicação

- Testes comportamentais de serviços, fonte individual, aliases/placeholder, contratos antigos, diff, IDs preservados, CPF/aceite/hash, PDF falhando sem promoção, upload único, assinatura idempotente, mudança de data/local e autenticação administrativa.
- SQL transacional com dados fictícios + rollback: versão vigente imutável até novo aceite, arquivo V1 preservado, mesmo evento/cliente/pré-contrato, parcelas/pago/escala intactos, revisão cancelada e nova base correta, rejeição de HTML antigo, bloqueio de alteração do histórico assinado e permissões RLS/RPC.
- Advisors: apenas INFO esperado de RLS sem policies na nova tabela, que é deliberadamente server-only, sem grants para anon/authenticated. Sem permissão RPC para esses papéis.
- A reconstrução do rascunho de contratos muito antigos sem fonte original utiliza a personalização/template disponível; por isso o administrador revisa o documento completo antes de publicar. O PDF/HTML anteriormente assinado é preservado integralmente, sem regeneração.
