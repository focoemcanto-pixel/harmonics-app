import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("details renderiza row.receipts sem filtro de month",()=>{const segment=s.slice(s.indexOf("<details"),s.indexOf("</details>"));assert.match(segment,/row\.receipts/);assert.doesNotMatch(segment,/month/)});
