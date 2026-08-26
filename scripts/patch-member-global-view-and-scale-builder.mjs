import fs from 'node:fs';

function patchFile(path, mutate) {
  const before = fs.readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after !== before) fs.writeFileSync(path, after);
  console.log(`[member global hardening] ${path}: ${after !== before ? 'atualizado' : 'já aplicado'}`);
}

patchFile('app/membro/page.js', (source) => {
  let out = source;

  const oldSelect = ".select('id, name, email, phone, tag, is_active, can_view_all_events, can_manage_schedules')";
  const newSelect = ".select('id, workspace_id, name, email, phone, tag, is_active, can_view_all_events, can_manage_schedules')";
  if (out.includes(oldSelect)) out = out.replace(oldSelect, newSelect);

  const oldFetch = "        const response = await fetch('/api/membro/global-dashboard' + suffix, {\n          method: 'GET',\n          cache: 'no-store',\n        });";
  const newFetch = "        const response = await fetch('/api/membro/global-dashboard' + suffix, {\n          method: 'GET',\n          cache: 'no-store',\n          headers: currentMember.workspace_id\n            ? { 'x-workspace-id': String(currentMember.workspace_id) }\n            : undefined,\n        });";
  if (!out.includes("'x-workspace-id': String(currentMember.workspace_id)") && out.includes(oldFetch)) {
    out = out.replace(oldFetch, newFetch);
  }

  return out;
});

patchFile('components/eventos/EventoEscalaTab.js', (source) => {
  let out = source;

  const oldQuery = "          supabase\n            .from('repertoire_config')\n            .select('status')\n            .eq('event_id', eventId)\n            .maybeSingle(),";
  const newQuery = "          supabase\n            .from('repertoire_config')\n            .select('status, updated_at')\n            .eq('event_id', eventId)\n            .order('updated_at', { ascending: false })\n            .limit(1),";
  if (out.includes(oldQuery)) out = out.replace(oldQuery, newQuery);

  const oldStatus = "      const repertorioStatusAtual = String(repertorioResp?.data?.status || '');";
  const newStatus = "      const repertorioStatusAtual = String(repertorioResp?.data?.[0]?.status || '');";
  if (out.includes(oldStatus)) out = out.replace(oldStatus, newStatus);

  return out;
});

console.log('[member global hardening] concluído');
