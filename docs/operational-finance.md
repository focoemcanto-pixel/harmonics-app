# Financeiro operacional Harmonics

## Diagnóstico e isolamento

Base auditada: `1b721c93276ac9ba003e3c457935efe8d1675b3f`, projeto Supabase `xsmdnbovjovfvdgnncje` (harmonics-saas-dev, referenciado pelo Harmonics). O banco possui 85 eventos, dos quais 49 têm data futura na auditoria de 13/10/2026. As contagens são do banco inteiro; a interface filtra pelo workspace autenticado e exclui eventos cancelados sem ficha operacional.

O legado usa `events` e `payments`, snapshots de valores pagos/em aberto, custos automáticos e `finance_cost_defaults`. Não foi reconciliado nem modificado. A comparação de todos os registros de `events` e `payments` com o snapshot retornou **zero alterações**. API antiga e seus cálculos foram preservados. A navegação ganhou um acesso separado em `/pagamentos/operacional`.

Somente campos cadastrais são lidos de eventos: id, cliente, data, local, formação, status e valor contratado (`agreed_amount`, sempre revisável na ficha). A escala é lida de `event_musicians` e seus nomes de `contacts`. Recebimentos, custos e padrões antigos nunca entram nos cálculos.

## Arquitetura e banco

Migration: `supabase/migrations/20261013110841_operational_finance.sql`, aplicada pelo nome `operational_finance`.

- `op_finance_settings`: saldo/data do marco zero, definido uma vez por workspace.
- `op_finance_events`: valor contratual revisado, custos individuais, estado de conferência e revisão otimista.
- `op_finance_defaults`: sugestões por músico ou função, independentes do legado.
- `op_finance_ledger`: recebimentos, pagamentos de custos, retiradas e estornos imutáveis.
- `op_finance_audit`: ator, antes/depois, ação e identificador único de operação.
- `operational_backup.initial_snapshot`: snapshot privado inicial de eventos, pagamentos e escala.

RPC `op_finance_command` executa comandos em transação, com bloqueio por workspace, idempotência, validação do vínculo do evento, revisão otimista e proteção contra pagamento superior ao custo. Não usa SECURITY DEFINER. As tabelas têm RLS e não têm grants para anon/authenticated; somente a API com service_role pode acessá-las. A API exige vínculo ativo no workspace com papel owner/admin/administrador/financeiro. O service_role permanece exclusivamente no servidor.

O aviso informativo de RLS sem políticas é intencional para essas tabelas: são API-only, com grants de cliente revogados. Os demais alertas de segurança encontrados pelo advisor são anteriores e fora do escopo. Referência do aviso: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.

## Arquivos principais

- `app/(admin)/pagamentos/operacional/page.js`: caixa, lista de eventos, ficha, recebimento rápido, retirada, padrões, músicos e histórico.
- `app/api/operational-finance/route.js`: leitura paginada isolada por workspace e comandos autenticados.
- `lib/operational-finance/model.mjs`: cálculos puros em centavos inteiros.
- Migration citada acima.
- `app/(admin)/pagamentos/page.js` e três componentes de navegação: somente links/rótulos.
- `tests/operational-finance.test.mjs` e `tests/operational-finance.integration.sql`.

Não foram incluídas alterações feitas automaticamente pelos scripts antigos de prebuild em módulos não relacionados.

## Fórmulas

Os originais estornados permanecem no histórico, mas saem dos cálculos ativos.

- Recebido do evento = soma dos recebimentos operacionais ativos, inclusive históricos.
- A receber = máximo(contrato conferido − recebido, 0). Excesso de recebimento aparece separadamente.
- Custo total = soma dos cachês e custos previstos/confirmados da ficha.
- Saldo de cada custo = máximo(custo acordado − pagamentos ativos desse custo, 0).
- Margem do evento = contrato − custo total. Retirada pessoal não altera essa margem.
- Caixa atual = saldo inicial + recebimentos posteriores não incluídos no saldo inicial − pagamentos posteriores não incluídos − retiradas posteriores não incluídas.
- Compromissos = saldos não pagos dos custos de fichas conferidas, inclusive eventos anteriores ainda com dívida.
- Caixa livre = caixa atual − compromissos.
- Posição projetada = caixa livre + a receber dos eventos conferidos. **A margem não é somada novamente.**
- Margem futura = soma das margens de eventos futuros conferidos.

Movimentos anteriores à data do marco zero são automaticamente históricos. Na mesma data ou depois, há opção explícita “já refletido no saldo inicial”. Isso é necessário para reconstruir contratos sem contar de novo o dinheiro já incluído no saldo inicial informado.

Fichas não conferidas não entram em compromissos, margem ou contas a receber consolidadas. O dashboard informa quantos eventos faltam e que a posição ainda é parcial. Movimentos reais lançados manualmente sempre afetam o caixa conforme o marco zero.

## Validação

- 26 testes do modelo e regressão do cálculo legado: aprovados.
- Teste SQL em transação com ROLLBACK: aprovado. Cobriu marco zero protegido, recebimentos múltiplos/históricos, idempotência, ficha, padrão, pagamento parcial/total, estorno, estorno duplicado, retirada, custo pago não removível, limite do pagamento, revisão concorrente, histórico imutável, usuário sem vínculo, grants de cliente e legado intacto.
- ESLint dos arquivos novos de página/API: aprovado.
- Build Next de produção: aprovado; inclui `/pagamentos/operacional` e `/api/operational-finance`.
- Nove testes existentes de credenciais Google: aprovados. O teste existente de integração OAuth não roda diretamente via Node por não resolver o alias `@/lib`; não houve mudança nesse módulo.
- Fixtures SQL foram desfeitas; nenhuma movimentação ou saldo inicial de teste ficou no banco.

## Limitações e estado de publicação

O banco foi preparado, mas a publicação do frontend/API ainda exige autenticação Cloudflare nesta sessão. Wrangler informou “You are not authenticated”; o dashboard abriu a tela de login. Não se deve anunciar o fluxo como validado em produção antes do deploy e do teste autenticado.

Comprovante opcional é um link HTTPS; upload direto de arquivo não está implementado. Alterações futuras na escala não substituem acordos financeiros salvos: a ficha oferece os músicos novos ao reabrir, e a equipe deve reconferir os custos. A posição projetada é consolidada e não prevê liquidez por data de vencimento. O marco zero não pode ser sobrescrito pela interface; correções de movimentos usam estorno e novo lançamento.

## Primeira conferência após publicação

1. Financeiro → Caixa & Compromissos — novo financeiro.
2. Definir saldo atual atribuído à Harmonics e data do marco zero.
3. Configurações → salvar cachês sugeridos por músico/função.
4. Eventos → filtrar não conferidos → abrir primeiro casamento.
5. Revisar o valor contratado. Registrar cada recebimento real; marcar como histórico quando já estiver refletido no saldo inicial.
6. Conferir escala e editar cada cachê; adicionar som, transporte e demais custos.
7. Salvar em conferência, se for registrar pagamentos já feitos aos músicos/custos. Marcar esses pagamentos históricos quando já incluídos no saldo inicial.
8. Salvar como CONFERIDO ou Salvar e próximo evento.
9. Repetir e revisar Caixa & Compromissos e Músicos a pagar.

Para recebimentos posteriores: buscar nome/data, informar valor e salvar. A origem padrão é WhatsApp e a forma padrão é Pix. Não é exigido comprovante.
