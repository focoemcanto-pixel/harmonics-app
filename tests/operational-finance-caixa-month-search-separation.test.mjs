import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("mês só escolhe period e não filtra rows",()=>{assert.match(page,/months\.find\(x=>x\.month===month\)/);const rowsExpr=page.slice(page.indexOf("rows=(overview"),page.indexOf("async function postMovement"));assert.doesNotMatch(rowsExpr,/month===/)});
