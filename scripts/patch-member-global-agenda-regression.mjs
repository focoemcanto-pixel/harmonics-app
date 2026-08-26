import fs from 'node:fs';

const path = 'app/membro/page.js';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

function replaceOnce(oldText, newText, marker) {
  if (marker && source.includes(marker)) return;
  if (!source.includes(oldText)) {
    throw new Error(`[member global regression] Trecho esperado não encontrado: ${oldText.slice(0, 140)}`);
  }
  source = source.replace(oldText, newText);
  changed = true;
}

replaceOnce(
  ".select('id, name, email, phone, tag, is_active, can_view_all_events, can_manage_schedules')",
  ".select('id, workspace_id, name, email, phone, tag, is_active, can_view_all_events, can_manage_schedules')",
  "workspace_id, name, email, phone, tag, is_active, can_view_all_events"
);

replaceOnce(
  "        const response = await fetch('/api/membro/global-dashboard' + suffix, {\n          method: 'GET',\n          cache: 'no-store',\n        });",
  "        const response = await fetch('/api/membro/global-dashboard' + suffix, {\n          method: 'GET',\n          cache: 'no-store',\n          headers: currentMember.workspace_id\n            ? { 'x-workspace-id': String(currentMember.workspace_id) }\n            : undefined,\n        });",
  "'x-workspace-id': String(currentMember.workspace_id)"
);

replaceOnce(
  "        if (!response.ok || !payload?.ok) {\n          throw new Error(payload?.error || 'Não foi possível carregar a agenda global.');\n        }\n\n        console.info('[MEMBER_PANEL][GLOBAL_AGENDA_API]', {\n          memberId: currentMember.id,\n          isAdmin: Boolean(currentMember.isAdmin),\n          delegated: Boolean(currentMember.canViewAllEvents && !currentMember.isAdmin),\n          workspaceId: payload.workspaceId || null,\n          events: Array.isArray(payload.events) ? payload.events.length : 0,\n        });\n\n        setDemoScaleRows(Array.isArray(payload.scales) ? payload.scales : []);\n        setInvites(Array.isArray(payload.invites) ? payload.invites : []);\n        setPrecontracts(Array.isArray(payload.precontracts) ? payload.precontracts : []);\n        setContracts(Array.isArray(payload.contracts) ? payload.contracts : []);\n        setRepertoireConfigs(Array.isArray(payload.repertoireConfigs) ? payload.repertoireConfigs : []);\n        setRepertoireItems(Array.isArray(payload.repertoireItems) ? payload.repertoireItems : []);\n        return;",
  "        if (response.ok && payload?.ok) {\n          console.info('[MEMBER_PANEL][GLOBAL_AGENDA_API]', {\n            memberId: currentMember.id,\n            isAdmin: Boolean(currentMember.isAdmin),\n            delegated: Boolean(currentMember.canViewAllEvents && !currentMember.isAdmin),\n            workspaceId: payload.workspaceId || null,\n            events: Array.isArray(payload.events) ? payload.events.length : 0,\n          });\n\n          setDemoScaleRows(Array.isArray(payload.scales) ? payload.scales : []);\n          setInvites(Array.isArray(payload.invites) ? payload.invites : []);\n          setPrecontracts(Array.isArray(payload.precontracts) ? payload.precontracts : []);\n          setContracts(Array.isArray(payload.contracts) ? payload.contracts : []);\n          setRepertoireConfigs(Array.isArray(payload.repertoireConfigs) ? payload.repertoireConfigs : []);\n          setRepertoireItems(Array.isArray(payload.repertoireItems) ? payload.repertoireItems : []);\n          return;\n        }\n\n        console.warn('[MEMBER_PANEL][GLOBAL_AGENDA_FALLBACK]', {\n          memberId: currentMember.id,\n          workspaceId: currentMember.workspace_id || null,\n          status: response.status,\n          error: payload?.error || 'Agenda global indisponível',\n        });\n        // Não zera o painel se a agenda global falhar: cai para as consultas pessoais abaixo.\n        setError('');",
  "[MEMBER_PANEL][GLOBAL_AGENDA_FALLBACK]"
);

if (changed) fs.writeFileSync(path, source);
console.log(`[member global regression] ${changed ? 'corrigido' : 'já aplicado'}`);
