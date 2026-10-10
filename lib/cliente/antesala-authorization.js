export function isAntesalaAuthorized(event = {}) {
  const status = String(event.antesala_request_status || '').trim().toLowerCase();
  if (status === 'pending' || status === 'rejected') return false;
  return event.has_antesala === true || event.antesala_enabled === true;
}

export function isAntesalaSection(item = {}) {
  const section = String(item.section || '').trim().toLowerCase();
  return section === 'antesala' || section === 'antessala';
}
