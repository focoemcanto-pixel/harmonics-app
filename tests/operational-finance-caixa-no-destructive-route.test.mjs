import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const operational=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("rota operacional continua implementação completa e não mero reexport",()=>{assert.ok(operational.length>10000);assert.match(operational,/function Finance/);assert.doesNotMatch(operational,/^export \{ default \}/)});
