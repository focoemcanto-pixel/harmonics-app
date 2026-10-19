import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const panel=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("painel escreve somente pela API operacional",()=>{assert.match(panel,/fetch\("\/api\/operational-finance"/);assert.doesNotMatch(panel,/supabase\./)});
