import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("formulário oferece Pix transferência dinheiro e outro",()=>{for(const text of ["Pix","transferência","dinheiro","outro"])assert.match(source,new RegExp(text))});
