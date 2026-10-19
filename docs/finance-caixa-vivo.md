# Caixa Vivo — Financeiro Operacional

Semântica aprovada:

- Caixa real = saldo do marco zero + movimentos posteriores não marcados como já incluídos no marco zero.
- Recebimento real aumenta o caixa e reduz o saldo a receber do mesmo evento; nunca é somado por cima da previsão original.
- Retirada reduz caixa e projeção, mas não é custo econômico do evento. Tipos de UI: Empréstimo, Distribuição/Lucro, Pró-labore e Outros.
- Custos de músicos e demais custos previstos pesam na projeção enquanto o evento ainda não passou.
- Depois da data do evento, esses custos deixam de ser obrigação futura e passam a custo realizado: reduzem o caixa real na data do evento, sem baixa músico a músico e sem criar lançamentos. Pagamentos já registrados para o mesmo custo não são deduzidos de novo; eventos anteriores ao marco zero e eventos cancelados não são deduzidos.
- Caixa real = caixa inicial + recebimentos posteriores − retiradas − pagamentos de custos − custos de eventos realizados após o marco zero (motor único em `cashPosition`).
- Caixa projetado = caixa real + saldo ainda a receber - custos futuros dos eventos.
- A margem econômica permanece contrato - custos, independentemente de retiradas.
- O seletor mensal controla apenas a leitura do fluxo. A busca do checklist é global por cliente, data e local.
- Experiência única em /pagamentos/operacional: Visão geral, Eventos e recebimentos, Histórico, Músicos a pagar e Configurações. Os endereços antigos (caixa, recebimentos) redirecionam para a seção correspondente.
- Histórico, estornos, conferência, configurações e demais controles da tela operacional existente são preservados; esta evolução não reescreve ledger nem contratos históricos.
