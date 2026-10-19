import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/operacional/layout.js",import.meta.url),"utf8");
test("layout não substitui conteúdo das páginas",()=>{assert.match(source,/\{children\}/);assert.doesNotMatch(source,/AdminShell/)});
