import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("painel explica projeção positiva",()=>assert.match(s,/Após receber os saldos conhecidos e cumprir os próximos eventos/));
