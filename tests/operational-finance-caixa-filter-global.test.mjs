import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("busca e status não usam seletor mensal",()=>{const segment=source.slice(source.indexOf("rows=(overview"),source.indexOf("async function postMovement"));assert.match(segment,/filter===/);assert.doesNotMatch(segment,/period/)});
