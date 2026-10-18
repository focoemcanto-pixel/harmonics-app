import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const alias=readFileSync(new URL("../app/(admin)/pagamentos/operacional/caixa/page.js",import.meta.url),"utf8");
test("rota caixa reutiliza a mesma implementação do painel",()=>assert.equal(alias.trim(),'export { default } from "../../recebimentos/page";'));
