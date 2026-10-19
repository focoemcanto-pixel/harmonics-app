import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const alias=readFileSync(new URL("../app/(admin)/pagamentos/operacional/recebimentos/page.js",import.meta.url),"utf8");
test("alias anterior continua apontando à tela de recebimentos",()=>assert.match(alias,/recebimentos\/page/));
