import fs from 'node:fs';

const path = 'app/membro/page.js';
let source = fs.readFileSync(path, 'utf8');

const marker = '[MEMBER_PANEL][GLOBAL_AGENDA_API]';
if (source.includes(marker)) {
  console.log('[member global dashboard] já aplicado');
  process.exit(0);
}

const startMarker = `      // ✅ SE FOR ADMIN: Buscar TODOS os dados (sem filtro)\n      if (currentMember.isAdmin || currentMember.canViewAllEvents) {`;
const endMarker = `\n      // ✅ SE NÃO FOR ADMIN: Código original do membro (com filtro .eq('contact_id', currentMember.id))`;

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error('[member global dashboard] bloco global esperado não encontrado em app/membro/page.js');
}

const replacement = `      // Agenda global: admin e membros explicitamente autorizados usam endpoint server-side.\n      // Isso mantém a leitura isolada por workspace sem conceder papel de administrador ao contato.\n      if (currentMember.isAdmin || currentMember.canViewAllEvents) {\n        const params = new URLSearchParams();\n        if (isMemberPanelDemoGuide && demoEventId) params.set('eventId', demoEventId);\n        const suffix = params.toString() ? \\`?\\${params.toString()}\\` : '';\n        const response = await fetch(\\`/api/membro/global-dashboard\\${suffix}\\`, {\n          method: 'GET',\n          cache: 'no-store',\n        });\n        const payload = await response.json().catch(() => ({}));\n\n        if (!response.ok || !payload?.ok) {\n          throw new Error(payload?.error || 'Não foi possível carregar a agenda global.');\n        }\n\n        console.info('[MEMBER_PANEL][GLOBAL_AGENDA_API]', {\n          memberId: currentMember.id,\n          isAdmin: Boolean(currentMember.isAdmin),\n          delegated: Boolean(currentMember.canViewAllEvents && !currentMember.isAdmin),\n          workspaceId: payload.workspaceId || null,\n          events: Array.isArray(payload.events) ? payload.events.length : 0,\n        });\n\n        setDemoScaleRows(Array.isArray(payload.scales) ? payload.scales : []);\n        setInvites(Array.isArray(payload.invites) ? payload.invites : []);\n        setPrecontracts(Array.isArray(payload.precontracts) ? payload.precontracts : []);\n        setContracts(Array.isArray(payload.contracts) ? payload.contracts : []);\n        setRepertoireConfigs(Array.isArray(payload.repertoireConfigs) ? payload.repertoireConfigs : []);\n        setRepertoireItems(Array.isArray(payload.repertoireItems) ? payload.repertoireItems : []);\n        return;\n      }`;

source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
fs.writeFileSync(path, source);
console.log('[member global dashboard] app/membro/page.js atualizado');
