import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
test("entrada posterior ao marco zero soma normalmente",()=>{const r=dashboard([],[],[{id:"r",kind:"receipt",amount_cents:50000,occurred_on:"2026-10-11",in_opening:false}],{opening_on:"2026-10-10",opening_cents:100000},"2026-10-18");assert.equal(r.cash,150000)});
