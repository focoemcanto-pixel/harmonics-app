import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const layout=readFileSync(new URL("../app/(admin)/pagamentos/operacional/layout.js",import.meta.url),"utf8"),panel=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("release gate encontra rota e painel",()=>{assert.match(layout,/operacional\/caixa/);assert.match(panel,/Caixa projetado/)});
