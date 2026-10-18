import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("nova retirada é movimento posterior ao marco zero",()=>{assert.match(source,/kind:"withdrawal"/);assert.ok((source.match(/in_opening:false/g)||[]).length>=2)});
