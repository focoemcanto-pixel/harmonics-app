import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:40000}]},settings={opening_on:"2026-10-01",opening_cents:50000};
test("retirada baixa projeção e recebimento só converte previsão em caixa",()=>{const ledger=[{id:"w",kind:"withdrawal",amount_cents:20000,occurred_on:"2026-10-18",in_opening:false},{id:"r",event_id:"e",kind:"receipt",amount_cents:30000,occurred_on:"2026-10-18",in_opening:false}],r=dashboard([e],[s],ledger,settings,"2026-10-18");assert.equal(r.cash,60000);assert.equal(r.receivable,70000);assert.equal(r.projected,90000)});
