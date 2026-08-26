import fs from 'node:fs';

function patch(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  let changed = false;
  for (const { oldText, newText, marker } of replacements) {
    if (marker && source.includes(marker)) continue;
    if (!source.includes(oldText)) {
      throw new Error(`[delegated scale ux] trecho não encontrado em ${path}: ${oldText.slice(0, 160)}`);
    }
    source = source.replace(oldText, newText);
    changed = true;
  }
  if (changed) fs.writeFileSync(path, source);
  console.log(`[delegated scale ux] ${path}: ${changed ? 'atualizado' : 'já aplicado'}`);
}

patch('components/eventos/EventoEscalaTab.js', [
  {
    oldText: `          supabase\n            .from('contacts')\n            .select('*')\n            .order('name', { ascending: true }),`,
    newText: `          (async () => {\n            try {\n              const response = await fetch(\`/api/events/\${eventId}/scale-contacts\`, {\n                method: 'GET',\n                cache: 'no-store',\n              });\n              const payload = await response.json().catch(() => ({}));\n              if (!response.ok || !payload?.ok) {\n                return { data: [], error: new Error(payload?.error || 'Não foi possível carregar os membros disponíveis.') };\n              }\n              return { data: Array.isArray(payload?.data) ? payload.data : [], error: null };\n            } catch (error) {\n              return { data: [], error };\n            }\n          })(),`,
    marker: '/scale-contacts',
  },
]);

patch('components/membro/MembroEscalaModal.js', [
  {
    oldText: `{adminChecked && canEditScale && resolvedEvent?.id ? (`,
    newText: `{canEditScale && resolvedEvent?.id ? (`,
    marker: '{canEditScale && resolvedEvent?.id ? (',
  },
]);

console.log('[delegated scale ux] concluído');
