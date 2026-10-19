import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
test("settings habilita bloco cash",()=>{const r=receivablesOverview([],[],[],{opening_on:"2026-10-01",opening_cents:12300},"2026-10-18");assert.equal(r.cash.current,12300);assert.equal(r.cash.projected,12300)});
