import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("financeiro organiza recebimentos sem substituir a visão completa", () => {
  const layout = fs.readFileSync("app/(admin)/pagamentos/operacional/layout.js", "utf8");
  const route = fs.readFileSync("app/(admin)/pagamentos/operacional/recebimentos/page.js", "utf8");
  assert.match(layout, /Visão operacional completa/);
  assert.match(layout, /Recebimentos e saldos/);
  assert.match(layout, /\/pagamentos\/operacional\/recebimentos/);
  assert.match(route, /recebimentos\/page/);
});
