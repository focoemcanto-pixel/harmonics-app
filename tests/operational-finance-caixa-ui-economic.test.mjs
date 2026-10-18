import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("painel mantém margem econômica separada da projeção",()=>{assert.match(page,/Margem econômica/);assert.match(page,/Cachês futuros/);assert.match(page,/Outros custos futuros/)});
