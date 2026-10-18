import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("card do evento separa recebido restante e resultado",()=>{for(const text of ["Já recebido","Falta receber","Resultado estimado"])assert.match(source,new RegExp(text))});
