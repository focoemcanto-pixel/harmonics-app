import { test } from "node:test";
import assert from "node:assert/strict";
import { activeEntries } from "../lib/operational-finance/model.mjs";
test("cálculos derivam do histórico ativo sem apagá-lo",()=>{const ledger=[{id:"r",kind:"receipt",amount_cents:1}],copy=structuredClone(ledger);activeEntries(ledger);assert.deepEqual(ledger,copy)});
