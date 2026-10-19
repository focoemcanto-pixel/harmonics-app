import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("tela operacional completa segue disponível",()=>{assert.match(page,/Caixa & Compromissos/);assert.match(page,/Eventos/);assert.match(page,/Configurações/)});
