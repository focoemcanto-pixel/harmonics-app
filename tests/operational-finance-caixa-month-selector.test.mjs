import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("painel mantém seletor de mês para ritmo do fluxo",()=>{assert.match(source,/type="month"/);assert.match(source,/Ritmo do mês/)});
