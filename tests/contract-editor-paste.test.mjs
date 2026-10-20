import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractContractTokens } from '../lib/contracts/pasteNormalize.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('tokens de contrato: placeholders e condicionais são extraídos na ordem, sem alteração', () => {
  const html = '<p>Contratante: {{client_name}}</p>{{#EXTRAS}}<ul><li>{{extras_list}}</li></ul>{{/EXTRAS}}{{#CARTAO}}<p>Taxa</p>{{/CARTAO}}';
  assert.deepEqual(extractContractTokens(html), ['{{client_name}}', '{{#EXTRAS}}', '{{extras_list}}', '{{/EXTRAS}}', '{{#CARTAO}}', '{{/CARTAO}}']);
});

test('normalizador: só reagrupa placeholders partidos por tags, sem reescrever o texto', () => {
  const source = read('lib/contracts/pasteNormalize.js');
  assert.match(source, /replace\(\/<\[\^>\]\*>\/g, ''\)/);
  assert.doesNotMatch(source, /\{\{[A-Za-z_#/]+\}\}['"]\s*[,:]/, 'não deve mapear/renomear placeholders');
});

test('editor: colagem passa pelo normalizador e não aninha blocos em títulos', () => {
  const editor = read('components/contracts/RichContractEditor.js');
  assert.match(editor, /import \{ normalizePastedContractHtml \} from '@\/lib\/contracts\/pasteNormalize'/);
  assert.match(editor, /normalizePastedContractHtml\(html\)/);
  assert.match(editor, /prepareBlockPaste\(/);
  assert.match(editor, /hx-doc hx-doc-editor/);
});

test('pré-visualizações usam o mesmo estilo de documento do editor (prose não está instalado)', () => {
  for (const path of ['components/precontratos/ContractTemplateEditorModal.js', 'components/contracts/LiveContractPreview.js']) {
    const source = read(path);
    assert.match(source, /className="hx-doc/, path);
    assert.doesNotMatch(source, /\bprose\b/, path);
  }
  assert.match(read('app/globals.css'), /\.hx-doc h1/);
});

test('listas a/A/i/I salvas exibem o marcador certo no editor e nas prévias, sem tocar placeholders', async () => {
  const { withOrderedListMarkers } = await import('../lib/contracts/listMarkers.js');
  assert.equal(withOrderedListMarkers('<ol type="a"><li>{{client_name}}</li></ol>'), '<ol type="a" style="list-style-type: lower-alpha"><li>{{client_name}}</li></ol>');
  assert.equal(withOrderedListMarkers('<ol type="I" style="margin:0">'), '<ol type="I" style="margin:0; list-style-type: upper-roman">');
  assert.equal(withOrderedListMarkers('<ol type="i" style="list-style-type: lower-roman">'), '<ol type="i" style="list-style-type: lower-roman">');
  assert.equal(withOrderedListMarkers('<ol><li>{{#EXTRAS}}x{{/EXTRAS}}</li></ol>'), '<ol><li>{{#EXTRAS}}x{{/EXTRAS}}</li></ol>');
  assert.equal(withOrderedListMarkers('<ol data-type="a">'), '<ol data-type="a">');
});
