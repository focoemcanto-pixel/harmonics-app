import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const settings={opening_on:"2026-10-10",opening_cents:100000};
test("movimento do dia do marco soma apenas se não estiver incluído",()=>{const included={id:"a",kind:"receipt",amount_cents:20000,occurred_on:"2026-10-10",in_opening:true},newEntry={id:"b",kind:"receipt",amount_cents:30000,occurred_on:"2026-10-10",in_opening:false};assert.equal(dashboard([],[],[included,newEntry],settings,"2026-10-18").cash,130000)});
