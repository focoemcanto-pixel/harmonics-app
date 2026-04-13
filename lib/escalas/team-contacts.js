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
