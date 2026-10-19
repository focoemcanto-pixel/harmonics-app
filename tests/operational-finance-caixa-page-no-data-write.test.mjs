import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("load é GET e escrita ocorre apenas nas ações explícitas",()=>{assert.match(source,/fetch\("\/api\/operational-finance",\{cache:"no-store"\}\)/);assert.match(source,/method:"POST"/)});
