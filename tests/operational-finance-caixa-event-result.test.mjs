import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"Cliente",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:30000},{id:"o",category:"operacional",amount_cents:10000}]};
test("resultado estimado é contrato menos custos",()=>assert.equal(receivablesOverview([e],[s],[],null,"2026-10-18").rows[0].margin,60000));
