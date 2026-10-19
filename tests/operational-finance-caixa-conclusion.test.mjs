import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const doc=readFileSync(new URL("../docs/finance-caixa-vivo.md",import.meta.url),"utf8"),layout=readFileSync(new URL("../app/(admin)/pagamentos/operacional/layout.js",import.meta.url),"utf8");
test("feature documentada e acessível",()=>{assert.match(doc,/Caixa projetado/);assert.match(layout,/Caixa vivo/)});
