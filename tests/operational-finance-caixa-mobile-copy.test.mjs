import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("ações principais têm rótulos diretos",()=>{for(const label of ["Registrar retirada","Registrar recebimento","Abrir evento","Ver histórico"])assert.match(page,new RegExp(label))});
