import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("alerta negativo explica que contratos não cobrem compromissos",()=>assert.match(source,/contratos conhecidos cobrirem os próximos compromissos/));
