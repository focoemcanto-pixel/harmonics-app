import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const event={id:"e1",client_name:"Cliente",event_date:"2026-10-20",agreed_amount:1000,status:"confirmado"};
const sheet={event_id:"e1",status:"checked",contract_cents:100000,costs:[{id:"m1",category:"musician",amount_cents:40000}]};
const settings={opening_on:"2026-10-01",opening_cents:500000};
test("receber converte previsão em caixa sem alterar projeção",()=>{const before=dashboard([event],[sheet],[],settings,"2026-10-18");const receipt={id:"r",event_id:"e1",kind:"receipt",amount_cents:30000,occurred_on:"2026-10-18",in_opening:false};const after=dashboard([event],[sheet],[receipt],settings,"2026-10-18");assert.equal(after.cash-before.cash,30000);assert.equal(before.receivable-after.receivable,30000);assert.equal(after.projected,before.projected)});
test("retirada reduz projeção no mesmo valor",()=>{const before=dashboard([event],[sheet],[],settings,"2026-10-18");const withdrawal={id:"w",kind:"withdrawal",amount_cents:80000,occurred_on:"2026-10-18",in_opening:false};const after=dashboard([event],[sheet],[withdrawal],settings,"2026-10-18");assert.equal(before.projected-after.projected,80000)});
test("evento passado não exige baixa manual de músico",()=>{const before=dashboard([event],[sheet],[],settings,"2026-10-20");const after=dashboard([event],[sheet],[],settings,"2026-10-21");assert.equal(before.musician,40000);assert.equal(after.musician,0)});
