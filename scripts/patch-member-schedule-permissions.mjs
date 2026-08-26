import fs from 'node:fs';

function patchFile(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  let changed = false;

  for (const { oldText, newText, marker, optional = false } of replacements) {
    if (marker && source.includes(marker)) continue;
    if (!source.includes(oldText)) {
      if (optional) {
        console.log(`[member schedule permissions] ${path}: trecho legado ausente, ignorado`);
        continue;
      }
      throw new Error(`[member schedule permissions] Trecho esperado não encontrado em ${path}: ${oldText.slice(0, 120)}`);
    }
    source = source.replace(oldText, newText);
    changed = true;
  }

  if (changed) fs.writeFileSync(path, source);
  console.log(`[member schedule permissions] ${path}: ${changed ? 'atualizado' : 'já aplicado'}`);
}

patchFile('app/api/contacts/route.js', [
  {
    oldText: "  'id, workspace_id, created_at, name, email, phone, tag, notes, contact_type, is_active';",
    newText: "  'id, workspace_id, created_at, name, email, phone, tag, notes, contact_type, is_active, can_view_all_events, can_manage_schedules';",
    marker: 'can_manage_schedules\';',
  },
  {
    oldText: "    contact_type: asString(payload.contact_type) || 'musician',\n    is_active: payload.is_active !== false,\n    workspace_id: workspaceId,",
    newText: "    contact_type: asString(payload.contact_type) || 'musician',\n    is_active: payload.is_active !== false,\n    can_view_all_events:\n      asString(payload.contact_type) === 'client'\n        ? false\n        : payload.can_view_all_events === true || payload.can_manage_schedules === true,\n    can_manage_schedules:\n      asString(payload.contact_type) === 'client' ? false : payload.can_manage_schedules === true,\n    workspace_id: workspaceId,",
    marker: 'payload.can_view_all_events === true || payload.can_manage_schedules === true',
  },
]);

patchFile('app/(admin)/contatos/page.js', [
  {
    oldText: "    contact_type: 'musician',\n    is_active: true,",
    newText: "    contact_type: 'musician',\n    is_active: true,\n    can_view_all_events: false,\n    can_manage_schedules: false,",
    marker: 'can_manage_schedules: false,',
  },
  {
    oldText: "  'id, created_at, name, email, phone, tag, notes, contact_type, is_active';",
    newText: "  'id, created_at, name, email, phone, tag, notes, contact_type, is_active, can_view_all_events, can_manage_schedules';",
    marker: "is_active, can_view_all_events, can_manage_schedules';",
  },
  {
    oldText: "      contact_type: resolveContactType(contato),\n      is_active: contato.is_active !== false,",
    newText: "      contact_type: resolveContactType(contato),\n      is_active: contato.is_active !== false,\n      can_view_all_events: contato.can_view_all_events === true,\n      can_manage_schedules: contato.can_manage_schedules === true,",
    marker: 'can_view_all_events: contato.can_view_all_events === true',
  },
  {
    oldText: "      contact_type: form.contact_type,\n      is_active: !!form.is_active,",
    newText: "      contact_type: form.contact_type,\n      is_active: !!form.is_active,\n      can_view_all_events:\n        form.contact_type !== 'client' && (!!form.can_view_all_events || !!form.can_manage_schedules),\n      can_manage_schedules: form.contact_type !== 'client' && !!form.can_manage_schedules,",
    marker: "form.contact_type !== 'client' && (!!form.can_view_all_events || !!form.can_manage_schedules)",
  },
]);

patchFile('components/contatos/ContatosFormularioTab.js', [
  {
    oldText: "  const isClient = form.contact_type === 'client';",
    newText: "  const isClient = form.contact_type === 'client';\n  const isOperationalContact = !isClient;",
    marker: 'const isOperationalContact = !isClient;',
  },
  {
    oldText: "      <div className=\"mt-6 rounded-[22px] border border-[#dbe3ef] bg-[#f8fafc] p-4\">\n        <label className=\"flex items-start gap-3\">",
    newText: "      {isOperationalContact ? (\n        <div className=\"mt-6 rounded-[22px] border border-violet-200 bg-violet-50/60 p-4\">\n          <div className=\"text-[12px] font-black uppercase tracking-[0.08em] text-violet-700\">\n            Permissões no painel do membro\n          </div>\n          <p className=\"mt-1 text-[14px] leading-6 text-[#64748b]\">\n            Libere apenas para quem deve atuar na operação da agenda e das escalas.\n          </p>\n\n          <div className=\"mt-4 space-y-3\">\n            <label className=\"flex items-start gap-3 rounded-[18px] border border-violet-100 bg-white px-4 py-3\">\n              <input\n                type=\"checkbox\"\n                checked={!!form.can_view_all_events}\n                onChange={(e) => {\n                  const checked = e.target.checked;\n                  handleFormChange('can_view_all_events', checked);\n                  if (!checked) handleFormChange('can_manage_schedules', false);\n                }}\n                className=\"mt-1 h-4 w-4 rounded border-[#cbd5e1] text-violet-600 focus:ring-violet-500\"\n              />\n              <div>\n                <div className=\"text-[14px] font-black text-[#0f172a]\">Visualizar agenda global</div>\n                <p className=\"mt-1 text-[13px] leading-5 text-[#64748b]\">\n                  Exibe no painel do membro todos os eventos operacionais, como na visão administrativa, mesmo quando ele não está escalado.\n                </p>\n              </div>\n            </label>\n\n            <label className=\"flex items-start gap-3 rounded-[18px] border border-violet-100 bg-white px-4 py-3\">\n              <input\n                type=\"checkbox\"\n                checked={!!form.can_manage_schedules}\n                onChange={(e) => {\n                  const checked = e.target.checked;\n                  if (checked) handleFormChange('can_view_all_events', true);\n                  handleFormChange('can_manage_schedules', checked);\n                }}\n                className=\"mt-1 h-4 w-4 rounded border-[#cbd5e1] text-violet-600 focus:ring-violet-500\"\n              />\n              <div>\n                <div className=\"text-[14px] font-black text-[#0f172a]\">Montar e editar escalas</div>\n                <p className=\"mt-1 text-[13px] leading-5 text-[#64748b]\">\n                  Libera o botão Montar/Editar dentro da agenda global e permite salvar a escala e disparar os convites, sem transformar o membro em administrador do sistema.\n                </p>\n              </div>\n            </label>\n          </div>\n        </div>\n      ) : null}\n\n      <div className=\"mt-6 rounded-[22px] border border-[#dbe3ef] bg-[#f8fafc] p-4\">\n        <label className=\"flex items-start gap-3\">",
    marker: 'Permissões no painel do membro',
  },
]);

patchFile('app/membro/page.js', [
  {
    oldText: ".select('id, name, email, phone, tag, is_active')",
    newText: ".select('id, name, email, phone, tag, is_active, can_view_all_events, can_manage_schedules')",
    marker: "can_view_all_events, can_manage_schedules')",
  },
  {
    oldText: '    setMember(data);',
    newText: "    setMember({\n      ...data,\n      isAdmin: false,\n      canViewAllEvents: data.can_view_all_events === true || data.can_manage_schedules === true,\n      canManageSchedules: data.can_manage_schedules === true,\n    });",
    marker: 'canManageSchedules: data.can_manage_schedules === true',
  },
  {
    oldText: '      if (currentMember.isAdmin) {',
    newText: '      if (currentMember.isAdmin || currentMember.canViewAllEvents) {',
    marker: 'currentMember.isAdmin || currentMember.canViewAllEvents',
  },
  {
    oldText: "                  {member?.isAdmin ? '🔑 Visão administrativa' : 'Painel premium do músico'}",
    newText: "                  {member?.isAdmin\n                    ? '🔑 Visão administrativa'\n                    : member?.canViewAllEvents\n                      ? '🗓️ Agenda global liberada'\n                      : 'Painel premium do músico'}",
    marker: "'🗓️ Agenda global liberada'",
  },
  {
    oldText: "        musicians={scaleModalMusicians}\n        onClose={() => {",
    newText: "        musicians={scaleModalMusicians}\n        canManageSchedule={Boolean(member?.isAdmin || member?.canManageSchedules)}\n        onClose={() => {",
    marker: 'canManageSchedule={Boolean(member?.isAdmin || member?.canManageSchedules)}',
  },
]);

// Este arquivo já recebeu versões posteriores do modal. As substituições abaixo
// são compatibilidade com a versão antiga e não devem derrubar o build se o
// trecho legado já tiver sido removido por outro patch.
patchFile('components/membro/MembroEscalaModal.js', [
  {
    oldText: 'export default function MembroEscalaModal({ open, eventTitle, musicians = [], onClose }) {',
    newText: 'export default function MembroEscalaModal({ open, eventTitle, musicians = [], canManageSchedule = false, onClose }) {',
    marker: 'canManageSchedule = false',
    optional: true,
  },
  {
    oldText: '  const hasScale = displayedMusicians.length > 0;',
    newText: '  const hasScale = displayedMusicians.length > 0;\n  const canEditScale = isAdmin || canManageSchedule;',
    marker: 'const canEditScale = isAdmin || canManageSchedule;',
    optional: true,
  },
  {
    oldText: '    if (!isAdmin && Array.isArray(musicians) && musicians.length > 0 && refreshKey === 0) return undefined;',
    newText: '    if (!canEditScale && Array.isArray(musicians) && musicians.length > 0 && refreshKey === 0) return undefined;',
    marker: '!canEditScale && Array.isArray(musicians)',
    optional: true,
  },
  {
    oldText: '  }, [open, eventTitle, musicians, isAdmin, refreshKey]);',
    newText: '  }, [open, eventTitle, musicians, canEditScale, refreshKey]);',
    marker: '[open, eventTitle, musicians, canEditScale, refreshKey]',
    optional: true,
  },
  {
    oldText: '                  {adminChecked && isAdmin && resolvedEvent?.id ? (',
    newText: '                  {adminChecked && canEditScale && resolvedEvent?.id ? (',
    marker: 'adminChecked && canEditScale && resolvedEvent?.id',
    optional: true,
  },
]);

patchFile('app/api/events/[id]/scale/route.js', [
  {
    oldText: "import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';",
    newText: "import { requireScheduleManagerAccess } from '@/lib/api/require-schedule-manager-access';",
    marker: "require-schedule-manager-access';",
  },
  {
    oldText: "    const auth = await requireWorkspaceAdmin({ supabase, request, logPrefix: '[EVENT_SCALE_API]' });",
    newText: "    const auth = await requireScheduleManagerAccess({ supabase, request, logPrefix: '[EVENT_SCALE_API]' });",
    marker: "requireScheduleManagerAccess({ supabase, request, logPrefix: '[EVENT_SCALE_API]' })",
  },
]);

patchFile('app/api/whatsapp/send-event-invites/route.js', [
  {
    oldText: "import { requireWorkspaceAdmin } from '../../../../lib/api/require-workspace-access';",
    newText: "import { requireScheduleManagerAccess } from '../../../../lib/api/require-schedule-manager-access';",
    marker: "require-schedule-manager-access';",
  },
  {
    oldText: "    const auth = await requireWorkspaceAdmin({\n      supabase: supabaseAdmin,\n      request,\n      logPrefix: '[WHATSAPP_SEND_EVENT_INVITES]',\n    });",
    newText: "    const auth = await requireScheduleManagerAccess({\n      supabase: supabaseAdmin,\n      request,\n      logPrefix: '[WHATSAPP_SEND_EVENT_INVITES]',\n    });",
    marker: 'const auth = await requireScheduleManagerAccess({',
  },
]);

console.log('[member schedule permissions] patch concluído.');
