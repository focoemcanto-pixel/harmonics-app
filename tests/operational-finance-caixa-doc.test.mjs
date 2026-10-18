import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const doc=readFileSync(new URL("../docs/finance-caixa-vivo.md",import.meta.url),"utf8");
test("documentação fixa fórmula e semântica de retirada",()=>{assert.match(doc,/Caixa projetado = caixa real \+ saldo ainda a receber - custos futuros/);assert.match(doc,/Retirada reduz caixa e projeção/)});
