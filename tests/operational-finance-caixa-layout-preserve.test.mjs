import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const layout=readFileSync(new URL("../app/(admin)/pagamentos/operacional/layout.js",import.meta.url),"utf8");
test("layout mantém caixa vivo e operação completa lado a lado",()=>{assert.match(layout,/Caixa vivo/);assert.match(layout,/Operação completa/);assert.match(layout,/Recebimentos/)});
