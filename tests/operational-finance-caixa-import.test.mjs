import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
test("overview aceita settings opcional sem quebrar compatibilidade",()=>{const result=receivablesOverview([],[],[],null,"2026-10-18");assert.deepEqual(result.rows,[]);assert.equal(result.cash,null)});
