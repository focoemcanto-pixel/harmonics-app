import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
test("teste registra que feature não exige migration dedicada",()=>{const names=readdirSync(new URL("../supabase/migrations/",import.meta.url));assert.equal(names.some(n=>n.includes("caixa_vivo")),false)});
