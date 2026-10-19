import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const model=readFileSync(new URL("../lib/operational-finance/model.mjs",import.meta.url),"utf8"),panel=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8"),op=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("modelo painel e operação completa coexistem",()=>{assert.match(model,/projected/);assert.match(panel,/Caixa vivo/);assert.match(op,/function Finance/)});
