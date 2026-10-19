import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("interface usa dados e não nomes de clientes de validação",()=>{for(const name of ["Joseane","Diana","Raissa","Bianca","Alexinaldo"])assert.doesNotMatch(page,new RegExp(name,"i"))});
