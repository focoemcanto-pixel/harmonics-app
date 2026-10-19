import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard, monthlyCommitments } from "../lib/operational-finance/model.mjs";
test("módulo de caixa vivo carrega funções centrais",()=>{assert.equal(typeof dashboard,"function");assert.equal(typeof monthlyCommitments,"function")});
