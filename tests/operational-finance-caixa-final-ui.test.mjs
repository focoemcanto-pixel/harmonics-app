import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("experiência final contém caixa projeção retirada e checklist",()=>{for(const x of ["Caixa vivo","Caixa projetado","Registrar retirada","Checklist de recebimentos"])assert.match(s,new RegExp(x))});
