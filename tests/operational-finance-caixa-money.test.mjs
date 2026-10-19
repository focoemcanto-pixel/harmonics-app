import { test } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../lib/operational-finance/model.mjs";
test("entrada monetária brasileira converte para centavos inteiros",()=>{assert.equal(cents("1.234,56"),123456);assert.equal(cents("500"),50000)});
