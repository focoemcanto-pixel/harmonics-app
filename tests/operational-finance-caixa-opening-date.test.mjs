import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const settings={opening_on:"2026-10-10",opening_cents:100000};
test("movimento anterior ao marco zero não altera caixa atual",()=>{const old={id:"r",kind:"receipt",amount_cents:90000,occurred_on:"2026-10-09",in_opening:false};assert.equal(dashboard([],[],[old],settings,"2026-10-18").cash,100000)});
