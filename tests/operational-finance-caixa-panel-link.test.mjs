import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("caixa vivo oferece retorno à operação completa",()=>{assert.match(source,/href="\/pagamentos\/operacional"/);assert.match(source,/Operação completa/)});
