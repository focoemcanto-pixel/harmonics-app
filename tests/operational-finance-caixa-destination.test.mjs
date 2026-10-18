import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("retirada registra destino e observação",()=>{assert.match(source,/destination:withdrawal\.destination/);assert.match(source,/withdrawal\.notes/)});
