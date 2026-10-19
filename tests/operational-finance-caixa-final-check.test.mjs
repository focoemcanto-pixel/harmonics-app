import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
test("dashboard operacional permanece determinístico",()=>{const args=[[],[],[],{opening_on:"2026-10-01",opening_cents:12345},"2026-10-18"];assert.deepEqual(dashboard(...args),dashboard(...args))});
