import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const d=readFileSync(new URL("../docs/finance-caixa-vivo.md",import.meta.url),"utf8");
test("documento explicita projeção e automação de custos",()=>{assert.match(d,/Caixa projetado =/);assert.match(d,/não é exigida baixa músico a músico/)});
