import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s=readFileSync(new URL("../app/(admin)/pagamentos/operacional/layout.js",import.meta.url),"utf8");
test("navegação oferece caixa operação e recebimentos",()=>{for(const x of ["Caixa vivo","Operação completa","Recebimentos"])assert.match(s,new RegExp(x))});
