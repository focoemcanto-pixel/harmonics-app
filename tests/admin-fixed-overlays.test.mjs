import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const modal = readFileSync(new URL("../components/precontratos/ContractTemplateEditorModal.js", import.meta.url), "utf8");
const client = readFileSync(new URL("../app/(admin)/pre-contratos/PreContratosClient.js", import.meta.url), "utf8");

test("animação do conteúdo do admin não cria bloco de contenção para modais fixed", () => {
  const keyframes = css.slice(css.indexOf("@keyframes hxEnter"), css.indexOf("}", css.indexOf("to {", css.indexOf("@keyframes hxEnter"))) + 1);
  assert.doesNotMatch(keyframes, /transform|filter/);
  assert.doesNotMatch(css.match(/\[data-hx-enter='true'\]\s*\{[^}]*\}/)[0], /\bboth\b|\bforwards\b/);
});

test("editor do pré-contrato não é reidratado a cada tecla", () => {
  assert.doesNotMatch(modal, /initialHtml=\{draft\}/);
  assert.match(modal, /initialHtml=\{initialEditorHtml\}/);
});

test("abrir o editor carrega o template aplicado quando a lista ainda não foi carregada", () => {
  const open = client.slice(client.indexOf("async function openContractEditor"), client.indexOf("function handleSaveContractCustomization"));
  assert.match(open, /carregarModelosContrato\(\{ force: true \}\)/);
  assert.match(open, /setContractEditorOpen\(true\)/);
});

test("carregamento de templates em andamento é reaproveitado (não devolve lista vazia)", () => {
  const load = client.slice(client.indexOf("async function carregarModelosContrato"), client.indexOf("async function", client.indexOf("async function carregarModelosContrato") + 10));
  assert.match(load, /if \(contractTemplatesRequestRef\.current\) return contractTemplatesRequestRef\.current;/);
  assert.doesNotMatch(load, /if \(contractTemplatesLoading\) return contractTemplates;/);
});
