import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("rota de recebimentos continua sendo implementação real",()=>{const page=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");assert.match(page,/ProtectedRoute/);assert.match(page,/Receivables/)});
