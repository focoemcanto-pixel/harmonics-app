import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const op=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8"),model=readFileSync(new URL("../lib/operational-finance/model.mjs",import.meta.url),"utf8");
test("gate final preserva operação e torna automação apenas derivada",()=>{assert.ok(op.length>40000);assert.match(model,/futureEventCosts/);assert.doesNotMatch(model,/insert|update|delete/i)});
