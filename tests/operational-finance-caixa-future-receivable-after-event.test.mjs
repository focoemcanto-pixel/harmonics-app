import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-10-01",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[]};
test("passar evento não presume pagamento do cliente",()=>assert.equal(dashboard([e],[s],[],{opening_on:"2026-10-01",opening_cents:0},"2026-10-18").receivable,10000));
