import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/(admin)/pagamentos/operacional/page.js", "utf8");

test("financeiro operacional preserva os fluxos existentes", () => {
  assert.match(page, /Caixa & Compromissos/);
  assert.match(page, /Eventos/);
  assert.match(page, /Músicos a pagar/);
  assert.match(page, /Configurações/);
  assert.match(page, /Registrar recebimento/);
  assert.match(page, /Registrar retirada/);
  assert.match(page, /eventSummary/);
  assert.match(page, /activeEntries/);
});
