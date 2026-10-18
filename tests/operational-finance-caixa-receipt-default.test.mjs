import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("registrar recebimento pré-preenche o saldo aberto",()=>assert.match(source,/row\.open\/100/));
