import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const old=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8"),fresh=readFileSync(new URL("../app/(admin)/pagamentos/recebimentos/page.js",import.meta.url),"utf8");
test("novo painel é complementar e não substitui controles antigos",()=>{assert.ok(old.length>fresh.length);assert.match(old,/Configurações/);assert.match(fresh,/Caixa vivo/)});
