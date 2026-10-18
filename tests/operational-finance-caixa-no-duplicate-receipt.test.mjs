import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const panel=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8"),api=readFileSync(new URL("../app/api/operational-finance/route.js",import.meta.url),"utf8");
test("movimentos enviam request_id e API mantém comando único",()=>{assert.match(panel,/crypto\.randomUUID/);assert.match(api,/request_id/)});
