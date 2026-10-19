import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("caixa projetado usa destaque visual",()=>assert.match(source,/title="Caixa projetado" value=\{cash\.projected\} strong/));
