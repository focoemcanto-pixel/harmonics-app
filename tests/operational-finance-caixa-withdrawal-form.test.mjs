import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("retirada informa tipo destino data e observação",()=>{for(const text of ["Tipo","Destino","Data","Observação"])assert.match(source,new RegExp(text))});
