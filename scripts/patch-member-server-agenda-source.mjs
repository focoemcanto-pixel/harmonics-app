import fs from 'node:fs';

const path = 'app/membro/page.js';
let source = fs.readFileSync(path, 'utf8');
const original = source;

// The global-dashboard API is the authoritative source for delegated agenda access.
// A staff/member contact must not depend only on the browser-side contacts query to
// discover can_view_all_events. We probe the server after resolving the session and,
// when access is granted, upgrade the resolved member before dashboard loading.
const anchor = '    setMember(data);';
const patchedAnchor = `    let resolvedMember = {
      ...data,
      isAdmin: false,
      canViewAllEvents: data.can_view_all_events === true || data.can_manage_schedules === true,
      canManageSchedules: data.can_manage_schedules === true,
    };

    // Server-authoritative delegated agenda probe. This intentionally works for
    // staff and musician/member contacts alike and uses the authenticated session.
    if (!resolvedMember.canViewAllEvents) {
      try {
        const agendaProbe = await fetch('/api/membro/global-dashboard', {
          method: 'GET',
          cache: 'no-store',
          headers: resolvedMember.workspace_id
            ? { 'x-workspace-id': String(resolvedMember.workspace_id) }
            : undefined,
        });
        if (agendaProbe.ok) {
          resolvedMember = {
            ...resolvedMember,
            canViewAllEvents: true,
          };
        }
      } catch (agendaProbeError) {
        console.warn('[MEMBRO][AGENDA_PERMISSION_PROBE]', agendaProbeError);
      }
    }

    setMember(resolvedMember);`;

if (source.includes(anchor)) {
  source = source.replace(anchor, patchedAnchor);
} else {
  // Previous build patches may already have expanded setMember(data). Replace that
  // exact block so this final guard remains deterministic and idempotent.
  const expanded = `    setMember({
      ...data,
      isAdmin: false,
      canViewAllEvents: data.can_view_all_events === true || data.can_manage_schedules === true,
      canManageSchedules: data.can_manage_schedules === true,
    });`;
  if (source.includes(expanded) && !source.includes('[MEMBRO][AGENDA_PERMISSION_PROBE]')) {
    source = source.replace(expanded, patchedAnchor);
  }
}

if (!source.includes('[MEMBRO][AGENDA_PERMISSION_PROBE]')) {
  throw new Error('[member server agenda source] could not wire server-authoritative agenda probe');
}

if (source !== original) {
  fs.writeFileSync(path, source);
  console.log('[member server agenda source] server-authoritative agenda permission wired');
} else {
  console.log('[member server agenda source] already wired');
}
