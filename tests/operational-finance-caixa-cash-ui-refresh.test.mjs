import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("movimento bem sucedido chama load antes de fechar formulário",()=>assert.match(source,/await load\(\);return true/));
