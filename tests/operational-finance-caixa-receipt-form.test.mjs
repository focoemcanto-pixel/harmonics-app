import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("recebimento informa valor data e forma",()=>{assert.match(source,/Valor \(R\$\)/);assert.match(source,/title="Data"/);assert.match(source,/title="Forma"/)});
