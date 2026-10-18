import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const layout=readFileSync(new URL("../app/(admin)/pagamentos/operacional/layout.js",import.meta.url),"utf8");
test("financeiro oferece entrada clara para caixa vivo",()=>assert.match(layout,/href="\/pagamentos\/operacional\/caixa"/));
