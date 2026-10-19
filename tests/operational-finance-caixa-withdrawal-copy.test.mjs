import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("modal explica que retirada não é custo do evento",()=>assert.match(source,/Reduz o caixa e a projeção, sem virar custo dos eventos/));
