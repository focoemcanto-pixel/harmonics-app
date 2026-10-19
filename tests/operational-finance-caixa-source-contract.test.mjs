import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const model=readFileSync(new URL("../lib/operational-finance/model.mjs",import.meta.url),"utf8");
const receivables=readFileSync(new URL("../lib/operational-finance/receivables.mjs",import.meta.url),"utf8");
test("modelo preserva marco zero e fórmula projetada",()=>{assert.match(model,/!x\.in_opening/);assert.match(model,/projected:\s*cash\s*-\s*committed\s*\+\s*receivable/);assert.match(model,/event\.event_date < date/)});
test("overview expõe componentes do caixa vivo",()=>{for(const marker of ["futureCosts","futureMusicians","futureOther","remainingReceivables","withdrawals"])assert.match(receivables,new RegExp(marker))});
