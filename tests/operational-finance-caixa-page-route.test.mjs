import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("rota operacional caixa existe e aponta ao painel",()=>{const s=readFileSync(new URL("../app/(admin)/pagamentos/operacional/caixa/page.js",import.meta.url),"utf8");assert.match(s,/recebimentos\/page/)});
