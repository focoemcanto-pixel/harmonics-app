import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const operational=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8"),layout=readFileSync(new URL("../app/(admin)/pagamentos/operacional/layout.js",import.meta.url),"utf8");
test("configurações permanecem na operação completa acessível pelo layout",()=>{assert.match(operational,/Configurações/);assert.match(layout,/Operação completa/)});
