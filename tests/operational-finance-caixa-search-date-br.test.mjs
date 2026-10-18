import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("termo de busca inclui data invertida dd/mm/aaaa",()=>assert.match(source,/split\("-"\)\.reverse\(\)\.join\("\/"\)/));
