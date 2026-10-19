import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const op=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8"),panel=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("entrega final mantém operação e adiciona painel decisório",()=>{assert.match(op,/Músicos a pagar/);assert.match(panel,/Caixa real agora/);assert.match(panel,/Caixa projetado/)});
