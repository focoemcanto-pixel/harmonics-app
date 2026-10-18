import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/operacional/layout.js",import.meta.url),"utf8");
test("links do financeiro permanecem dentro de pagamentos operacional",()=>{assert.match(source,/\/pagamentos\/operacional\/caixa/);assert.match(source,/\/pagamentos\/operacional\/recebimentos/)});
