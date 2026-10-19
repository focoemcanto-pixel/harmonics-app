import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const op=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8"),panel=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("operação antiga e caixa vivo coexistem",()=>{assert.match(op,/function Finance/);assert.match(panel,/function Receivables/)});
