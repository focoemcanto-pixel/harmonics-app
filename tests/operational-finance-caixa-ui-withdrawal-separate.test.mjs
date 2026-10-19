import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("UI tem indicadores distintos de retirada e margem",()=>{assert.match(s,/Retiradas registradas/);assert.match(s,/Margem econômica/)});
