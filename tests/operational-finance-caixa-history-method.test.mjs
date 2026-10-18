import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("histórico renderiza entry.method",()=>assert.match(s,/entry\.method/));
