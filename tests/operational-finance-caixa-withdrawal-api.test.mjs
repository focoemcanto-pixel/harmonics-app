import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const api=readFileSync(new URL("../app/api/operational-finance/route.js",import.meta.url),"utf8"),page=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("retirada premium reutiliza kind withdrawal existente",()=>{assert.match(api,/"withdrawal"/);assert.match(page,/kind:"withdrawal"/)});
