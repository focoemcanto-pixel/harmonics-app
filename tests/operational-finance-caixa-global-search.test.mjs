import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("busca não depende do mês selecionado",()=>{assert.match(page,/const raw=search/);assert.match(page,/location_name/);assert.doesNotMatch(page,/row\.event_date\.startsWith\(month\)/)});
