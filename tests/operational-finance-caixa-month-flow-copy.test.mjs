import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("copy explica separação entre mês e busca global",()=>assert.match(source,/A busca de eventos abaixo continua global/));
