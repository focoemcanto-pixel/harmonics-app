import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("financeiro operacional usa a visão reconciliada de recebimentos", () => {
  const page = fs.readFileSync("app/(admin)/pagamentos/operacional/page.js", "utf8");
  const receivables = fs.readFileSync("app/(admin)/pagamentos/recebimentos/page.js", "utf8");
  assert.match(page, /ReceivablesPage/);
  assert.doesNotMatch(page, /Músicos a pagar|Obrigações por data|Caixa & Compromissos/);
  assert.match(receivables, /Entrou no mês/);
  assert.match(receivables, /Ainda a receber no mês/);
  assert.match(receivables, /Total esperado no mês/);
  assert.match(receivables, /Histórico de recebimentos/);
  assert.match(receivables, /Cachês permanecem no custo do evento/);
});
