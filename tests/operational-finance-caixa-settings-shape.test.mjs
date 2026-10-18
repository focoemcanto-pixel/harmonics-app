import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
test("settings nulo não explode cálculo básico",()=>{const r=dashboard([],[],[],null,"2026-10-18");assert.equal(r.cash,0);assert.equal(r.projected,0)});
