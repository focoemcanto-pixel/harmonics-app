import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("fluxo legado de músicos continua disponível para histórico e exceções",()=>assert.match(source,/Músicos a pagar/));
