import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("painel atualiza ao focar e periodicamente",()=>{assert.match(page,/addEventListener\("focus"/);assert.match(page,/setInterval\(refresh,60000\)/)});
