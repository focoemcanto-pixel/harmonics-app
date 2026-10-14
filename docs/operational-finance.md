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

## Ajuste solicitado: custos pré-preenchidos (13/10/2026)

Por autorização explícita do usuário, os padrões cadastrados de R$ 350/músico, R$ 300/som e R$ 200/transporte foram copiados uma única vez para os padrões independentes do workspace Harmonics, com registro na auditoria operacional. Nenhum recebimento, custo individual de evento ou agregado financeiro legado foi importado. Padrões operacionais já existentes não são sobrescritos.

A prioridade do cachê sugerido é músico → função → cachê geral. Sonorização e transporte entram como previstos somente quando o serviço está marcado no cadastro do evento. Todos os valores são editáveis. Acordos já salvos, inclusive valores zero, permanecem intactos. Os padrões gerais podem ser ajustados em Configurações. Seis testes adicionais cobrem prioridades, zero explícito, serviços contratados, não sobrescrever acordos e não duplicar custos: 32 testes aprovados no total.

## Planejamento mensal de compromissos

Caixa & Compromissos passa a priorizar o mês selecionado, com músicos, outros custos, total do mês, necessidade acumulada até o fim do mês e saldo do caixa atual após essa reserva. Recebimentos pendentes não reduzem a obrigação nem são tratados como caixa disponível.

Cada custo aceita `due_on` (Pagar até), opcional, armazenado no JSON da ficha operacional e preservado pela auditoria existente. Sem data manual, usa a data do evento e informa essa hipótese na interface. Não foi necessária migration; valores e registros salvos não foram alterados. Obrigações de meses anteriores são destacadas e incluídas na necessidade acumulada. A lista de obrigações é ordenada pela data de pagamento e abre a ficha correspondente.

A visão de todos os contratos permanece, com o rótulo “Saldo após reservar todos os eventos”, para não apresentar a reserva de meses futuros como uma necessidade imediata. Meses com eventos não conferidos são sinalizados como incompletos. O planejamento mostra o caixa necessário para compromissos; não projeta datas de recebimentos ainda não cadastradas.

Validação: 44 testes de modelo/regressão aprovados, incluindo meses separados, antecipação manual da data do cachê, pagamentos parciais/totais, obrigações anteriores, incompletude, ordenação por data e recebimentos sem reduzir artificialmente dívidas.

## Entradas previstas na projeção mensal

O planejamento mensal cruza caixa atual + saldos a receber até o mês − compromissos pendentes até o mês. A tabela mostra entradas, pagamentos e saldo projetado de cada mês, acumulando o saldo sem somar novamente recebimentos já realizados.

A migration `20261013143434_operational_receivable_forecast_date.sql` acrescenta `expected_receipt_on` opcional à ficha. Sem previsão manual, usa e identifica a data do evento como hipótese. A ficha permite ajustar a data esperada para receber o saldo em aberto. Previsões são apenas o saldo contratual conferido menos recebimentos operacionais ativos; não criam dinheiro em caixa ou novos lançamentos. Contratos quitados saem da previsão. Recebimentos anteriores ao mês atual ou sem data ficam destacados para reprogramação, sem presumir que chegarão em um mês futuro.

Foi salvo um snapshot privado das fichas antes da alteração. A RPC mantém as mesmas validações, auditoria, idempotência e revisão; clientes antigos que não enviam o campo não apagam uma previsão já salva. Validação: 50 testes de cálculo/regressão aprovados e teste SQL com rollback aprovado para persistência da previsão, compatibilidade com clientes antigos e preservação do contrato/custos.

## Remoção de custos preservada

Padrões de sonorização, transporte e operacional passam a preencher somente fichas ainda não salvas. Uma ausência em ficha já salva é preservada como decisão manual, inclusive em fichas antigas que removeram sonorização antes desta correção.

Novas remoções mantêm um marcador `excluded` no custo, com seu valor anterior guardado, e valor ativo zero. A ficha oculta o item da lista ativa; cálculos de margem, compromisso e projeção ignoram exclusões. O marcador impede também que a escala recrie cachês removidos. A auditoria da ficha preserva a alteração. Uma seção de custos removidos permite restaurar explicitamente o valor específico do evento. Custos já pagos continuam protegidos contra remoção pela interface e pela validação transacional existente.

## Prazo dos recebimentos e correção
O saldo em aberto é previsto para dois dias corridos antes do evento, inclusive na virada do mês. A ficha permite antecipar e o RPC rejeita previsão posterior ao prazo. Recebimentos realizados mantêm suas datas. Os recebimentos aparecem no início da ficha com estorno por motivo, mantendo o histórico e a auditoria.
