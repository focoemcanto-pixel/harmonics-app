import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyCommitments } from "../lib/operational-finance/model.mjs";
const e={id:"e",client_name:"Cliente",event_date:"2026-11-10",agreed_amount:1000,status:"confirmado"},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:30000}]};
test("planejamento mostra custo enquanto evento é futuro",()=>{const p=monthlyCommitments([e],[s],[],"2026-10-18"),nov=p.months.find(x=>x.month==="2026-11");assert.equal(nov.musician,30000);assert.equal(nov.receivable,100000)});
