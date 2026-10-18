import { test } from "node:test";
import assert from "node:assert/strict";
import { activeEntries } from "../lib/operational-finance/model.mjs";
test("entrada revertida sai dos movimentos ativos",()=>{const r=activeEntries([{id:"a",kind:"receipt"},{id:"x",kind:"reversal",reverses_id:"a"}]);assert.equal(r.length,0)});
