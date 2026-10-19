import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const panel=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("painel principal não apresenta ação de pagar músico",()=>{assert.doesNotMatch(panel,/Pagar músico/i);assert.match(panel,/Cachês futuros/)});
