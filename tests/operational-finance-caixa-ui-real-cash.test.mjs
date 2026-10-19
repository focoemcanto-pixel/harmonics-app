import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("painel chama saldo presente de Caixa real agora",()=>assert.match(s,/Caixa real agora/));
