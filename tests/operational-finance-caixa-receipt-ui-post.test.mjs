import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("novo recebimento do caixa vivo não é marcado como histórico",()=>{assert.match(source,/kind:"receipt"/);assert.match(source,/in_opening:false/)});
