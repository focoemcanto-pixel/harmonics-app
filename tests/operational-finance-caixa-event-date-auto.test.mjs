import { test } from "node:test";
import assert from "node:assert/strict";
import { futureEventCosts, eventSummary } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-10-20",agreed_amount:0},s={event_id:"e",status:"checked",contract_cents:0,costs:[{id:"m",category:"musician",amount_cents:10000}]};
test("regra automática compara event_date com data operacional",()=>{const summary=eventSummary(e,s,[]);assert.equal(futureEventCosts(e,summary,"2026-10-20").total,10000);assert.equal(futureEventCosts(e,summary,"2026-10-21").total,0)});
