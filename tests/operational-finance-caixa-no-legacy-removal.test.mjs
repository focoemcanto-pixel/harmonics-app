import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/(admin)/pagamentos/operacional/page.js",import.meta.url),"utf8");
test("abas antigas permanecem disponíveis",()=>{for(const text of ["Caixa & Compromissos","Eventos","Músicos a pagar","Configurações"])assert.match(source,new RegExp(text))});
