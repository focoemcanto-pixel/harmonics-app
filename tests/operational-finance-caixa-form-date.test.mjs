import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("recebimento e retirada limitam data ao hoje",()=>assert.ok((source.match(/max=\{today\(\)\}/g)||[]).length>=2));
