import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("ações usam row.event_id",()=>{assert.match(source,/event_id:row\.event_id/);assert.match(source,/key=\{row\.event_id\}/)});
