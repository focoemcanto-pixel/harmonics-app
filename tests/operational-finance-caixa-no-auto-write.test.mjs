import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const model=readFileSync(new URL("../lib/operational-finance/model.mjs",import.meta.url),"utf8");
test("baixa automática por data não cria movimento sintético",()=>{assert.match(model,/futureEventCosts/);assert.doesNotMatch(model,/kind:\s*["']payment["']/)});
