import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync } from "node:fs";
test("página operacional não pode virar alias mínimo",()=>assert.ok(statSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url)).size>30000));
