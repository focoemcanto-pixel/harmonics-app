import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
test("retirada incluída no marco zero é somente histórico",()=>{const r=dashboard([],[],[{id:"w",kind:"withdrawal",amount_cents:50000,occurred_on:"2026-10-18",in_opening:true}],{opening_on:"2026-10-01",opening_cents:100000},"2026-10-18");assert.equal(r.cash,100000)});
