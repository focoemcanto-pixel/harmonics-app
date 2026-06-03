import { isClientType, isMemberType } from '@/lib/contatos/contact-type';

export function isClientContact(contact) {
  return isClientType(contact);
}

export function isOperationalTeamContact(contact) {
  if (!contact) return false;
  if (contact.is_active === false) return false;
  if (isClientType(contact)) return false;

  return isMemberType(contact);
}

export function filterOperationalTeamContacts(contacts) {
  return (Array.isArray(contacts) ? contacts : []).filter(isOperationalTeamContact);
}

export function getRoleInstrumentTagsFromEvent(event) {
  const fromInstruments = String(event?.instruments || '').trim();
  const fromFormation = String(event?.formation || '').trim();
  const base = fromInstruments || fromFormation;
  const seen = new Set();

  return base
    .split(/[;,|/\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
