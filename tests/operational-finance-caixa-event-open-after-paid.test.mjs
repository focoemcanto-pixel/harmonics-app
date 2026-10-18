import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"C",event_date:"2026-11-01",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[]};
test("evento quitado continua nas linhas para filtro histórico",()=>{const r=receivablesOverview([e],[s],[{id:"r",event_id:"e",kind:"receipt",amount_cents:10000,occurred_on:"2026-10-18"}],null,"2026-10-18");assert.equal(r.rows.length,1);assert.equal(r.rows[0].status,"paid")});
