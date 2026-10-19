import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const layout=readFileSync(new URL("../app/(admin)/pagamentos/operacional/layout.js",import.meta.url),"utf8");
const alias=readFileSync(new URL("../app/(admin)/pagamentos/operacional/caixa/page.js",import.meta.url),"utf8");
test("navegação oferece caixa vivo e preserva operação completa",()=>{assert.match(layout,/pagamentos\/operacional\/caixa/);assert.match(layout,/href="\/pagamentos\/operacional"/);assert.match(alias,/recebimentos\/page/)});
