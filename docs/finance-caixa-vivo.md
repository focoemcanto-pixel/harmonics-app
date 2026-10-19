# Caixa Vivo — Financeiro Operacional

Semântica aprovada:

- Caixa real = saldo do marco zero + movimentos posteriores não marcados como já incluídos no marco zero.
- Recebimento real aumenta o caixa e reduz o saldo a receber do mesmo evento; nunca é somado por cima da previsão original.
- Retirada reduz caixa e projeção, mas não é custo econômico do evento. Tipos de UI: Empréstimo, Distribuição/Lucro, Pró-labore e Outros.
- Custos de músicos e demais custos previstos pesam na projeção enquanto o evento ainda não passou.
- Depois da data do evento, esses custos deixam de ser obrigação futura e passam a custo realizado: reduzem o caixa real na data do evento, sem baixa músico a músico e sem criar lançamentos. Pagamentos já registrados para o mesmo custo não são deduzidos de novo; eventos anteriores ao marco zero e eventos cancelados não são deduzidos.
- Caixa real = caixa inicial + recebimentos posteriores − retiradas − pagamentos de custos − custos de eventos realizados após o marco zero ± ajustes de conciliação (motor único em `cashPosition`).
- Ajuste de conciliação (`adjustment_in`/`adjustment_out`): usado só para a diferença residual entre o caixa reconstruído pelos registros e o saldo real conferido. Exige motivo, é posterior ao marco zero, não pertence a evento, não é retirada, não afeta margem e é estornável; fica no histórico e na auditoria.
- Caixa projetado = caixa real + saldo ainda a receber - custos futuros dos eventos.
- A margem econômica permanece contrato - custos, independentemente de retiradas.
- O seletor mensal controla apenas a leitura do fluxo. A busca do checklist é global por cliente, data e local.
- Experiência única em /pagamentos/operacional: Visão geral, Eventos e recebimentos, Histórico, Músicos a pagar e Configurações. Os endereços antigos (caixa, recebimentos) redirecionam para a seção correspondente.
- Histórico, estornos, conferência, configurações e demais controles da tela operacional existente são preservados; esta evolução não reescreve ledger nem contratos históricos.

## Decisão financeira

`financeDecision` deriva três leituras dos mesmos registros, sem gravar dados:

- Operação por competência do evento: contratado menos custos totais, com margem percentual. Recebimentos antecipados permanecem na competência do evento.
- Fluxo pendente por vencimento: somente saldos não recebidos e custos não pagos de eventos ainda futuros. Custos vencidos continuam exigíveis imediatamente.
- Posição cronológica: caixa real mais fluxos por dia. A reserva necessária é o maior déficit de qualquer prefixo dos fluxos restantes. Entradas anteriores podem financiar saídas posteriores; uma entrada posterior não cobre um déficit anterior. Entradas/saídas no mesmo dia são compensadas.

Caixa livre hoje = caixa real − reserva necessária hoje. Ao fim de cada mês, livre = caixa projetado daquele mês − reserva dos fluxos posteriores. Valor negativo mostra déficit. Retiradas e ajustes já compõem o caixa real; nunca são repetidos no fluxo pendente ou no lucro.

Recebíveis vencidos (inclusive no mês atual) ou sem previsão vigente ficam destacados como incertos, fora da projeção datada até reprogramação. Eventos sem conferência tornam a projeção parcial; custos desconhecidos não são inventados. A pesquisa global e todos os comandos/históricos permanecem no fluxo existente.
