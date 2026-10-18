import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const alias=readFileSync(new URL("../app/(admin)/pagamentos/operacional/caixa/page.js",import.meta.url),"utf8"),panel=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("entrada Caixa vivo reutiliza painel premium",()=>{assert.match(alias,/recebimentos\/page/);assert.match(panel,/Caixa vivo/)});
