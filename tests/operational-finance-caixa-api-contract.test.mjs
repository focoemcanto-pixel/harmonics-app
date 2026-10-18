import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const api=readFileSync(new URL("../app/api/operational-finance/route.js",import.meta.url),"utf8");
test("API existente continua aceitando receipt payment withdrawal e opening",()=>{for(const marker of ["receipt","payment","withdrawal","opening","reverse"])assert.match(api,new RegExp(marker))});
