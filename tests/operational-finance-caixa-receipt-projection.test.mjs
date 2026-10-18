import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
test("receita real e prevista nunca somam duas vezes",()=>{const e={id:"e",event_date:"2026-11-01",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[]},settings={opening_on:"2026-10-01",opening_cents:0},a=dashboard([e],[s],[],settings,"2026-10-18"),b=dashboard([e],[s],[{id:"r",event_id:"e",kind:"receipt",amount_cents:5000,occurred_on:"2026-10-18",in_opening:false}],settings,"2026-10-18");assert.equal(a.projected,b.projected)});
