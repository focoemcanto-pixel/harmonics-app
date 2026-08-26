import fs from 'node:fs';

function patch(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  let changed = false;
  for (const { oldText, newText, marker } of replacements) {
    if (marker && source.includes(marker)) continue;
    if (!source.includes(oldText)) {
      console.log(`[delegated scale ux] trecho já transformado/indisponível em ${path}: ${oldText.slice(0, 120)}`);
      continue;
    }
    source = source.replace(oldText, newText);
    changed = true;
  }
  if (changed) fs.writeFileSync(path, source);
  console.log(`[delegated scale ux] ${path}: ${changed ? 'atualizado' : 'já aplicado/compatível'}`);
}

const scalePath = 'components/eventos/EventoEscalaTab.js';
let scaleSource = fs.readFileSync(scalePath, 'utf8');

// Carrega todo o bootstrap da montagem em uma única rota server-side.
// Isso evita o Promise.all de várias consultas client-side sob RLS, que podia ficar preso
// indefinidamente para membros delegados e mantinha a tela em "Carregando escala...".
if (!scaleSource.includes('/scale-data')) {
  const pattern = /      const \[eventoResp, contatosResp, escalaResp, templatesResp, templateItemsResp, repertorioResp\] =\s*await Promise\.all\(\[[\s\S]*?\n        \]\);/m;
  const replacement = `      const controller = new AbortController();\n      const timeout = setTimeout(() => controller.abort(), 12000);\n      let bootstrap;\n      try {\n        const response = await fetch(\`/api/events/\${eventId}/scale-data\`, {\n          method: 'GET',\n          cache: 'no-store',\n          signal: controller.signal,\n        });\n        const payload = await response.json().catch(() => ({}));\n        if (!response.ok || !payload?.ok) {\n          throw new Error(payload?.error || 'Não foi possível carregar a montagem da escala.');\n        }\n        bootstrap = payload;\n      } finally {\n        clearTimeout(timeout);\n      }\n\n      const eventoResp = { data: bootstrap?.event || null, error: null };\n      const contatosResp = { data: Array.isArray(bootstrap?.contacts) ? bootstrap.contacts : [], error: null };\n      const escalaResp = { data: Array.isArray(bootstrap?.scale) ? bootstrap.scale : [], error: null };\n      const templatesResp = { data: Array.isArray(bootstrap?.templates) ? bootstrap.templates : [], error: null };\n      const templateItemsResp = { data: Array.isArray(bootstrap?.templateItems) ? bootstrap.templateItems : [], error: null };\n      const repertorioResp = { data: bootstrap?.repertoire || null, error: null };`;

  if (pattern.test(scaleSource)) {
    scaleSource = scaleSource.replace(pattern, replacement);
    fs.writeFileSync(scalePath, scaleSource);
    console.log('[delegated scale ux] EventoEscalaTab bootstrap unificado em /scale-data');
  } else {
    console.log('[delegated scale ux] bloco de bootstrap já transformado ou não localizado');
  }
}

patch('components/membro/MembroEscalaModal.js', [
  {
    oldText: `{adminChecked && canEditScale && resolvedEvent?.id ? (`,
    newText: `{canEditScale && resolvedEvent?.id ? (`,
    marker: '{canEditScale && resolvedEvent?.id ? (',
  },
]);

console.log('[delegated scale ux] concluído');
