import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
test("sem opening_cents caixa começa em zero",()=>assert.equal(dashboard([],[],[],{},"2026-10-18").cash,0));
