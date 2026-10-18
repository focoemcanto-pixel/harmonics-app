import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const events=[{id:"e",event_date:"2026-10-20",agreed_amount:1000}],sheets=[{event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:40000}]}],settings={opening_on:"2026-10-01",opening_cents:50000};
test("caixa futuro responde à pergunta se receitas cobrem compromissos",()=>{const r=dashboard(events,sheets,[],settings,"2026-10-18");assert.deepEqual({cash:r.cash,toReceive:r.receivable,toPay:r.committed,projected:r.projected},{cash:50000,toReceive:100000,toPay:40000,projected:110000})});
