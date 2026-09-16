import fs from 'node:fs';

const path = 'app/membro/page.js';
let source = fs.readFileSync(path, 'utf8');
const original = source;

// Final build guard: the member panel must read delegated permissions for both
// musician/member and staff contacts. Contact type/tag must never suppress an
// explicitly granted global-agenda permission.
source = source.replace(
  ".select('id, name, email, phone, tag, is_active')",
  ".select('id, name, email, phone, tag, contact_type, workspace_id, is_active, can_view_all_events, can_manage_schedules')"
);

// Also upgrade the already-patched select so workspace/contact type are carried
// into the resolved member object consistently.
source = source.replace(
  ".select('id, name, email, phone, tag, is_active, can_view_all_events, can_manage_schedules')",
  ".select('id, name, email, phone, tag, contact_type, workspace_id, is_active, can_view_all_events, can_manage_schedules')"
);

if (source.includes('    setMember(data);')) {
  source = source.replace(
    '    setMember(data);',
    `    setMember({
      ...data,
      isAdmin: false,
      canViewAllEvents: data.can_view_all_events === true || data.can_manage_schedules === true,
      canManageSchedules: data.can_manage_schedules === true,
    });`
  );
}

// If another patch already created the member object, keep the permission
// expression explicit and independent from tag/contact_type.
source = source.replace(
  /canViewAllEvents:\s*[^,\n]+,/,
  'canViewAllEvents: data.can_view_all_events === true || data.can_manage_schedules === true,'
);

// Guarantee the global branch is used for delegated viewers after every other
// member patch has run.
source = source.replace(
  /if \(currentMember\.isAdmin\) \{/g,
  'if (currentMember.isAdmin || currentMember.canViewAllEvents) {'
);

if (!source.includes('can_view_all_events') || !source.includes('currentMember.canViewAllEvents')) {
  throw new Error('[staff global agenda final] permission wiring was not applied');
}

if (source !== original) {
  fs.writeFileSync(path, source);
  console.log('[staff global agenda final] staff/member delegated agenda enforced');
} else {
  console.log('[staff global agenda final] already enforced');
}
