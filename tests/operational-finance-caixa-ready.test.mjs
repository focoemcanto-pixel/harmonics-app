import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
test("exports centrais do caixa vivo estão disponíveis",()=>{assert.equal(typeof dashboard,"function");assert.equal(typeof receivablesOverview,"function")});
