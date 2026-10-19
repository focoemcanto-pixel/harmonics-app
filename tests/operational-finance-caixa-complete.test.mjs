import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const doc=readFileSync(new URL("../docs/finance-caixa-vivo.md",import.meta.url),"utf8");
test("escopo documenta marco zero recebimentos retiradas custos e busca",()=>{for(const x of ["marco zero","Recebimento real","Retirada","Custos de músicos","busca do checklist é global"])assert.match(doc,new RegExp(x,"i"))});
