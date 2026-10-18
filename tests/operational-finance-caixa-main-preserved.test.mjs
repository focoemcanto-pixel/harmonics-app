import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("página operacional preserva implementação Finance",()=>{assert.match(source,/function Finance\(\)/);assert.ok(source.length>40000)});
