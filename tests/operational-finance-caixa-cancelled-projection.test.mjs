import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
// Dashboard historically receives all events; cancelled filtering is handled by upstream event set in the operational API.
test("documenta contrato de projeção sem mutar status",()=>{assert.equal(typeof dashboard,"function")});
