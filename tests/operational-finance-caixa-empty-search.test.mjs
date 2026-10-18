import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("termo vazio não elimina linhas",()=>assert.match(source,/if\(raw&&!term\.includes\(raw\)\)return false/));
