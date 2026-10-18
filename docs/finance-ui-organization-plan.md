# Organização do financeiro operacional

Regra central: organizar sem remover funcionalidades existentes.

A tela completa de `/pagamentos/operacional` permanece como base, incluindo caixa, eventos, conferência, lançamentos, retiradas, custos, cachês, pagamentos de músicos, configurações, estornos e histórico.

A reorganização deve distinguir visualmente:

1. Recebimentos: contratado, já recebido, saldo a receber e previsão do saldo.
2. Econômico: cachês + outros custos e margem do evento.
3. Caixa: entradas e saídas efetivamente realizadas.

Recebimentos reais devem consumir o saldo previsto, sem dupla contagem. Cachês continuam disponíveis e registrados, mas não devem dominar a visão principal como se fossem pendências operacionais obrigatórias. Nenhum lançamento histórico, valor contratado ou registro de pagamento deve ser apagado/recriado para produzir a nova apresentação.
