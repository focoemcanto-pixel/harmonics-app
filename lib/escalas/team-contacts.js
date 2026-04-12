function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const TEAM_TYPE_HINTS = ['musician', 'musico', 'músico', 'staff', 'team', 'equipe', 'member', 'membro'];
const CLIENT_TYPE_HINTS = ['client', 'cliente', 'contratante'];

function hasAnyHint(value, hints) {
  const normalized = normalize(value);
  if (!normalized) return false;
  return hints.some((hint) => normalized.includes(normalize(hint)));
}

export function isClientContact(contact) {
  const fields = [
    contact?.tag,
    contact?.tags,
    contact?.type,
    contact?.contact_type,
    contact?.category,
    contact?.role_type,
  ];

  return fields.some((value) => hasAnyHint(value, CLIENT_TYPE_HINTS));
}

export function isOperationalTeamContact(contact) {
  if (!contact) return false;
  if (contact.is_active === false) return false;
  if (isClientContact(contact)) return false;

  const fields = [
    contact?.tag,
    contact?.tags,
    contact?.type,
    contact?.contact_type,
    contact?.category,
    contact?.role_type,
  ];

  const hasTeamHint = fields.some((value) => hasAnyHint(value, TEAM_TYPE_HINTS));

  // Backward compatibility: when o cadastro antigo só tem "tag" com instrumento/função.
  // Nesses casos, qualquer contato ativo que não seja cliente segue elegível para a equipe.
  return hasTeamHint || fields.some(Boolean);
}

export function filterOperationalTeamContacts(contacts) {
  return (contacts || []).filter(isOperationalTeamContact);
}

export function getRoleInstrumentTagsFromEvent(event) {
  const fromInstruments = String(event?.instruments || '');
  const fromFormation = String(event?.formation || '');
  const base = fromInstruments || fromFormation;
  return base
    .split(/[;,|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
