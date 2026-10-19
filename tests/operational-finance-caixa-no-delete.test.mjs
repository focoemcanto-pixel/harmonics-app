import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const panel=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8"),model=readFileSync(new URL("../lib/operational-finance/model.mjs",import.meta.url),"utf8");
test("feature não introduz delete de ledger",()=>{assert.doesNotMatch(panel,/\.delete\(/);assert.doesNotMatch(model,/\.delete\(/)});
