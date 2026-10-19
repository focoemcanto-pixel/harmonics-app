import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("checklist oferece abertos parciais quitados e todos",()=>{for(const label of ["Ainda a receber","Parciais","Quitados","Todos"])assert.match(source,new RegExp(label))});
