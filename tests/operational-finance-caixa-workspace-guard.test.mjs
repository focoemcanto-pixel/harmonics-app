import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const api=readFileSync(new URL("../app/api/operational-finance/route.js",import.meta.url),"utf8");
test("financeiro continua exigindo workspace e papéis financeiros",()=>{assert.match(api,/requireWorkspaceAccess/);assert.match(api,/financeiro/);assert.match(api,/workspace_id/)});
