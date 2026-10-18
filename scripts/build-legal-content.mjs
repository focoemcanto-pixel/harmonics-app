// Gera lib/legal/content.js a partir de docs/legal/*.md (fonte única dos textos jurídicos).
// Rodar após editar os .md: node scripts/build-legal-content.mjs  (o teste legal-documents falha se divergir)
import { readFileSync, writeFileSync } from 'node:fs';

const terms = readFileSync(new URL('../docs/legal/termos-de-uso.md', import.meta.url), 'utf8');
const privacy = readFileSync(new URL('../docs/legal/politica-de-privacidade.md', import.meta.url), 'utf8');

const out = `// GERADO por scripts/build-legal-content.mjs a partir de docs/legal/*.md — não editar à mão.
export const TERMS_MARKDOWN = ${JSON.stringify(terms)};
export const PRIVACY_MARKDOWN = ${JSON.stringify(privacy)};
`;
writeFileSync(new URL('../lib/legal/content.js', import.meta.url), out);
console.log('lib/legal/content.js atualizado');
