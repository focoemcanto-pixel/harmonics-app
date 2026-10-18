import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("painel expõe quatro números decisórios",()=>{for(const text of ["Caixa real agora","Ainda a receber","Custos futuros","Caixa projetado"])assert.match(page,new RegExp(text))});
