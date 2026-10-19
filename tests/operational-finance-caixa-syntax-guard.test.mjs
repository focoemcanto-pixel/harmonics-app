import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
for(const path of ["../app/(admin)/pagamentos/operacional/page.js","../app/(admin)/pagamentos/operacional/layout.js"]){test(`arquivo ${path} mantém exports esperados`,()=>{const source=readFileSync(new URL(path,import.meta.url),"utf8");assert.match(source,/export default/);assert.ok(source.length>50)})}
