import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
test("overview continua utilizável sem settings",()=>{const r=receivablesOverview([],[],[]);assert.equal(r.cash,null);assert.deepEqual(r.totals,{contract:0,received:0,open:0,costs:0,margin:0,withdrawals:0})});
