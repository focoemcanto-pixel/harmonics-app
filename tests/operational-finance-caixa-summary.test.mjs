import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSummary } from "../lib/operational-finance/model.mjs";
test("summary mantém dimensões econômicas",()=>{const r=eventSummary({id:"e",agreed_amount:0},{event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"a",category:"musician",amount_cents:30000},{id:"b",category:"other",amount_cents:10000}]},[]);assert.equal(r.total,40000);assert.equal(r.margin,60000)});
