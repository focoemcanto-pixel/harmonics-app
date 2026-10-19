import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const page=read("app/(admin)/pagamentos/operacional/page.js"),layout=read("app/(admin)/pagamentos/operacional/layout.js"),caixa=read("app/(admin)/pagamentos/operacional/caixa/page.js"),receb=read("app/(admin)/pagamentos/operacional/recebimentos/page.js"),legacyReceb=read("app/(admin)/pagamentos/recebimentos/page.js"),model=read("lib/operational-finance/model.mjs"),doc=read("docs/finance-caixa-vivo.md");
test("navegação oferece visão geral, eventos e recebimentos, histórico",()=>{for(const x of ["Visão geral","Eventos e recebimentos","Histórico","Músicos a pagar","Configurações"])assert.match(page,new RegExp(x))});
