import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("cada card expõe histórico de lançamentos",()=>assert.match(s,/Ver histórico \(\{row\.receipts\.length\}\)/));
