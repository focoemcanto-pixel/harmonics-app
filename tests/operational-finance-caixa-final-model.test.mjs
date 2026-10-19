import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
test("dashboard retorna todas as dimensões gerenciais",()=>{const r=dashboard([],[],[],{opening_on:"2026-10-01",opening_cents:0},"2026-10-18");for(const k of ["cash","musician","other","committed","free","receivable","margin","projected","unchecked"])assert.ok(k in r)});
