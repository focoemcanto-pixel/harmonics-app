import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const page=read("app/(admin)/pagamentos/operacional/page.js"),layout=read("app/(admin)/pagamentos/operacional/layout.js"),caixa=read("app/(admin)/pagamentos/operacional/caixa/page.js"),receb=read("app/(admin)/pagamentos/operacional/recebimentos/page.js"),legacyReceb=read("app/(admin)/pagamentos/recebimentos/page.js"),model=read("lib/operational-finance/model.mjs"),doc=read("docs/finance-caixa-vivo.md");
test("financeiro unificado não remove a operação detalhada",()=>{for(const marker of ["Eventos","Configurações","withdrawal","reverse","Salvar como CONFERIDO","payment"])assert.match(page,new RegExp(marker,"i"))});
test("financeiro mantém retirada, busca global e histórico",()=>{for(const marker of ["Registrar retirada","Empréstimo","Checklist de recebimentos","Ver histórico","location_name"])assert.match(page,new RegExp(marker,"i"))});
