import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("documentação da feature existe",()=>assert.ok(readFileSync(new URL("../docs/finance-caixa-vivo.md",import.meta.url),"utf8").length>100));
