import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const operational = readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js", import.meta.url), "utf8");
const live = readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js", import.meta.url), "utf8");
test("evolução do caixa vivo não remove a operação detalhada", () => {
  for (const marker of ["Eventos", "Configurações", "withdrawal", "reversal", "conference", "payment"]) assert.match(operational, new RegExp(marker, "i"));
});
test("caixa vivo mantém retirada, busca global e histórico", () => {
  for (const marker of ["Registrar retirada", "Empréstimo", "Checklist de recebimentos", "Ver histórico", "location_name"]) assert.match(live, new RegExp(marker, "i"));
});
