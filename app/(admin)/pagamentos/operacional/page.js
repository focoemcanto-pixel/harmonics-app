import ReceivablesPage from "../recebimentos/page";

// O fluxo operacional principal agora é a visão reconciliada de recebimentos.
// A implementação preserva o mesmo ledger/API do financeiro operacional:
// recebido real abate o saldo previsto; custos permanecem econômicos e não
// aparecem como uma agenda principal de obrigações.
export default ReceivablesPage;
