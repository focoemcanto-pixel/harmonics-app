import fs from 'node:fs';

function patch(path, mutate) {
  let source = fs.readFileSync(path, 'utf8');
  const before = source;
  source = mutate(source);
  if (source !== before) fs.writeFileSync(path, source);
  console.log(`[member scale event isolation] ${path}: ${source !== before ? 'atualizado' : 'já aplicado'}`);
}

function replaceOnce(source, oldText, newText, marker) {
  if (marker && source.includes(marker)) return source;
  if (!source.includes(oldText)) {
    console.log(`[member scale event isolation] trecho não encontrado/compatível: ${oldText.slice(0, 100)}`);
    return source;
  }
  return source.replace(oldText, newText);
}

patch('app/membro/page.js', (source) => {
  source = replaceOnce(
    source,
    "  async function handleOpenScale(item) {\n    setScaleModalEvent(item || null);\n    setScaleModalMusicians([]);\n    setScaleModalOpen(true);",
    "  async function handleOpenScale(item) {\n    const eventKey = String(item?.eventId || '');\n    window.__harmonicsScaleRequestSeq = Number(window.__harmonicsScaleRequestSeq || 0) + 1;\n    const requestSeq = window.__harmonicsScaleRequestSeq;\n    const cachedScale = window.__harmonicsMemberScaleCache?.get?.(eventKey) || [];\n    setScaleModalEvent(item || null);\n    setScaleModalMusicians(Array.isArray(cachedScale) ? cachedScale : []);\n    setScaleModalOpen(true);",
    'window.__harmonicsScaleRequestSeq = Number(window.__harmonicsScaleRequestSeq || 0) + 1;'
  );

  source = replaceOnce(
    source,
    "      setScaleModalEvent(item || null);\n      setScaleModalMusicians(musicians);",
    "      if (requestSeq !== window.__harmonicsScaleRequestSeq) return;\n      if (!window.__harmonicsMemberScaleCache) window.__harmonicsMemberScaleCache = new Map();\n      window.__harmonicsMemberScaleCache.set(eventKey, musicians);\n      setScaleModalEvent(item || null);\n      setScaleModalMusicians(musicians);",
    'window.__harmonicsMemberScaleCache.set(eventKey, musicians);'
  );

  source = replaceOnce(
    source,
    "        eventTitle={scaleModalEvent?.clientName || 'Escala'}\n        eventId={scaleModalEvent?.eventId || null}\n        musicians={scaleModalMusicians}",
    "        eventTitle={scaleModalEvent?.clientName || 'Escala'}\n        eventId={scaleModalEvent?.eventId || null}\n        musicians={scaleModalMusicians}\n        canManageSchedule={Boolean(member?.isAdmin || member?.canManageSchedules)}",
    'musicians={scaleModalMusicians}\n        canManageSchedule={Boolean(member?.isAdmin || member?.canManageSchedules)}'
  );

  source = replaceOnce(
    source,
    "        eventTitle={scaleModalEvent?.clientName || 'Escala'}\n        musicians={scaleModalMusicians}",
    "        eventTitle={scaleModalEvent?.clientName || 'Escala'}\n        eventId={scaleModalEvent?.eventId || null}\n        musicians={scaleModalMusicians}\n        canManageSchedule={Boolean(member?.isAdmin || member?.canManageSchedules)}",
    'canManageSchedule={Boolean(member?.isAdmin || member?.canManageSchedules)}'
  );

  return source;
});

patch('components/membro/MembroEscalaModal.js', (source) => {
  // By the time this runs, the permission and instant-action patches should have
  // introduced eventId/canManageSchedule. Keep a fallback for direct source states.
  source = replaceOnce(
    source,
    'export default function MembroEscalaModal({ open, eventTitle, musicians = [], onClose }) {',
    'export default function MembroEscalaModal({ open, eventTitle, eventId = null, musicians = [], canManageSchedule = false, onClose }) {',
    'eventId = null, musicians = []'
  );
  source = replaceOnce(
    source,
    'export default function MembroEscalaModal({ open, eventTitle, musicians = [], canManageSchedule = false, onClose }) {',
    'export default function MembroEscalaModal({ open, eventTitle, eventId = null, musicians = [], canManageSchedule = false, onClose }) {',
    'eventId = null, musicians = []'
  );

  source = replaceOnce(
    source,
    "  const cached = scaleCache.get(String(eventTitle || '').trim()) || null;",
    "  const scaleCacheKey = String(eventId || eventTitle || '').trim();\n  const cached = scaleCache.get(scaleCacheKey) || null;",
    'const scaleCacheKey = String(eventId || eventTitle || \'\').trim();'
  );

  source = replaceOnce(
    source,
    "  const hasScale = displayedMusicians.length > 0;",
    "  const hasScale = displayedMusicians.length > 0;\n  const canEditScale = isAdmin || canManageSchedule;\n  const immediateEventId = eventId || resolvedEvent?.id || null;",
    'const immediateEventId = eventId || resolvedEvent?.id || null;'
  );

  // Reset transient rows every time a different event opens. This prevents the
  // previous event's musicians from flashing while the new event is loading.
  source = replaceOnce(
    source,
    "  useEffect(() => {\n    if (!open) {\n      setFallbackError('');",
    "  useEffect(() => {\n    if (open) {\n      const nextKey = String(eventId || eventTitle || '').trim();\n      const nextCached = scaleCache.get(nextKey);\n      setFallbackMusicians(Array.isArray(nextCached?.musicians) ? nextCached.musicians : []);\n      setResolvedEvent(eventId ? { id: eventId } : nextCached?.event || null);\n      setHasRefreshedScale(false);\n      setFallbackError('');\n    }\n  }, [open, eventId, eventTitle]);\n\n  useEffect(() => {\n    if (!open) {\n      setFallbackError('');",
    'setResolvedEvent(eventId ? { id: eventId } : nextCached?.event || null);'
  );

  source = source.replaceAll('scaleCache.get(clientName)', 'scaleCache.get(String(eventId || clientName))');
  source = source.replaceAll('scaleCache.set(clientName, {', 'scaleCache.set(String(eventId || clientName), {');
  source = source.replaceAll("scaleCache.delete(String(eventTitle || '').trim())", "scaleCache.delete(String(eventId || eventTitle || '').trim())");

  // Whenever the parent returns fresh musicians, cache them by event ID rather
  // than client name. This makes reopening the same event instant and prevents
  // collisions between different events/clients.
  source = replaceOnce(
    source,
    "    const clientName = String(eventTitle || '').trim();\n    if (!clientName) return;\n    const previous = scaleCache.get(String(eventId || clientName)) || {};\n    scaleCache.set(String(eventId || clientName), { ...previous, musicians, cachedAt: Date.now() });\n  }, [open, eventTitle, musicians]);",
    "    const clientName = String(eventTitle || '').trim();\n    const cacheKey = String(eventId || clientName).trim();\n    if (!cacheKey) return;\n    const previous = scaleCache.get(cacheKey) || {};\n    scaleCache.set(cacheKey, { ...previous, event: eventId ? { id: eventId } : previous?.event || null, musicians, cachedAt: Date.now() });\n    setFallbackMusicians(musicians);\n    if (eventId) setResolvedEvent({ id: eventId });\n  }, [open, eventId, eventTitle, musicians]);",
    'setFallbackMusicians(musicians);\n    if (eventId) setResolvedEvent({ id: eventId });'
  );

  // The delegated permission is already resolved by /membro. Do not wait for a
  // second admin lookup before painting the action button.
  source = source.replace(/\{adminChecked && (?:isAdmin|canEditScale) && [^?]+\? <button/g, '{canEditScale && immediateEventId ? <button');
  source = source.replace('{canEditScale ? <button', '{canEditScale && immediateEventId ? <button');
  source = source.replace('{builderOpen && resolvedEvent?.id ? <div', '{builderOpen && immediateEventId ? <div');
  source = source.replaceAll('eventId={resolvedEvent.id}', 'eventId={immediateEventId}');

  // Make the by-client fallback event-aware. Parent data remains the primary,
  // fast path; the fallback only fills gaps without contaminating another event.
  source = source.replace('  }, [open, eventTitle, refreshKey]);', '  }, [open, eventId, eventTitle, refreshKey]);');

  return source;
});

console.log('[member scale event isolation] patch concluído.');
