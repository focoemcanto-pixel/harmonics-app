import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("retirada oferece categorias gerenciais aprovadas",()=>{for(const item of ["Empréstimo","Distribuição/Lucro","Pró-labore","Outros"])assert.match(page,new RegExp(item))});
