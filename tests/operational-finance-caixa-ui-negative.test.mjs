import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("painel alerta quando caixa projetado fica negativo",()=>{assert.match(page,/cash\.projected<0/);assert.match(page,/Atenção:/)});
