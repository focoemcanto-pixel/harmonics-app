import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("tipo da retirada é anotação do movimento",()=>{assert.match(source,/\[withdrawal\.category,withdrawal\.notes\]/);assert.doesNotMatch(source,/category:withdrawal\.category/)});
