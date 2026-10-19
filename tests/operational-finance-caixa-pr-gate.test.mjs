import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const d=readFileSync(new URL("../docs/finance-caixa-vivo.md",import.meta.url),"utf8");test("escopo está explicitamente não destrutivo",()=>assert.match(d,/preservados/));
