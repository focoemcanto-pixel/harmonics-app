'use client';

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const CLIENT_HINTS = ['client', 'cliente', 'contratante'];
const MEMBER_HINTS = ['musician', 'musico', 'membro', 'member', 'team', 'equipe', 'staff'];

function hasHint(value, hints) {
  const normalized = normalize(value);
  return normalized ? hints.some((hint) => normalized.includes(hint)) : false;
}

export function resolveContactType(contact) {
  const explicitType = normalize(contact?.contact_type || contact?.type || contact?.role_type || contact?.category);

  if (hasHint(explicitType, CLIENT_HINTS)) return 'client';
  if (explicitType === 'staff') return 'staff';
  if (hasHint(explicitType, MEMBER_HINTS)) return explicitType === 'staff' ? 'staff' : 'musician';

  const tag = normalize(contact?.tag || contact?.tags);

  if (hasHint(tag, CLIENT_HINTS)) return 'client';
  if (tag === 'staff') return 'staff';
  if (hasHint(tag, MEMBER_HINTS) || tag) return tag === 'staff' ? 'staff' : 'musician';

  return 'musician';
}

export function isClientType(contact) {
  return resolveContactType(contact) === 'client';
}

export function isMemberType(contact) {
  const type = resolveContactType(contact);
  return type === 'musician' || type === 'staff';
}

export function getContactTypeLabel(contact) {
  const type = resolveContactType(contact);
  if (type === 'client') return 'Cliente';
  if (type === 'staff') return 'Staff';
  return 'Membro';
}
