# Financeiro operacional — fluxo principal

A rota `/pagamentos/operacional` usa a visão reconciliada de recebimentos.

- realizado = recebimentos ativos efetivamente lançados;
- saldo a receber = contrato menos recebimentos ativos;
- previsão = somente o saldo ainda não recebido;
- total esperado = realizado + saldo restante, sem duplicar previsão antiga;
- cachês e demais custos continuam compondo custo/margem econômica do evento;
- cachês não são exibidos como agenda principal de pendências/obrigações;
- histórico de recebimentos permanece visível por evento e usa o ledger operacional existente;
- nenhum lançamento histórico é apagado ou reescrito por esta mudança.
