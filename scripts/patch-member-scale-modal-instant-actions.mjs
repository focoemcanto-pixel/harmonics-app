import fs from 'node:fs';

function patchSource(path, mutate) {
  let source = fs.readFileSync(path, 'utf8');
  const original = source;
  source = mutate(source);
  if (source !== original) fs.writeFileSync(path, source);
  console.log(`[member scale instant actions] ${path}: ${source !== original ? 'corrigido' : 'já aplicado/compatível'}`);
}

function replaceIfPresent(source, oldText, newText, marker) {
  if (marker && source.includes(marker)) return source;
  if (!source.includes(oldText)) {
    console.log(`[member scale instant actions] trecho já transformado ou indisponível: ${oldText.slice(0, 100)}`);
    return source;
  }
  return source.replace(oldText, newText);
}

patchSource('app/membro/page.js', (source) => {
  source = replaceIfPresent(
    source,
    "        eventTitle={scaleModalEvent?.clientName || 'Escala'}\n        musicians={scaleModalMusicians}",
    "        eventTitle={scaleModalEvent?.clientName || 'Escala'}\n        eventId={scaleModalEvent?.eventId || null}\n        musicians={scaleModalMusicians}",
    'eventId={scaleModalEvent?.eventId || null}'
  );
  return source;
});

patchSource('components/membro/MembroEscalaModal.js', (source) => {
  source = replaceIfPresent(
    source,
    'export default function MembroEscalaModal({ open, eventTitle, musicians = [], canManageSchedule = false, onClose }) {',
    'export default function MembroEscalaModal({ open, eventTitle, eventId = null, musicians = [], canManageSchedule = false, onClose }) {',
    'eventId = null, musicians = []'
  );

  source = replaceIfPresent(
    source,
    '  const hasScale = displayedMusicians.length > 0;\n  const canEditScale = isAdmin || canManageSchedule;',
    "  const hasScale = displayedMusicians.length > 0;\n  const canEditScale = isAdmin || canManageSchedule;\n  const immediateEventId = useMemo(() => {\n    if (eventId) return eventId;\n    const fromResolved = resolvedEvent?.id;\n    if (fromResolved) return fromResolved;\n    const sourceRows = Array.isArray(musicians) ? musicians : [];\n    const row = sourceRows.find((item) => item?.event_id || item?.event?.id);\n    return row?.event_id || row?.event?.id || null;\n  }, [eventId, resolvedEvent, musicians]);",
    'const immediateEventId = useMemo(() => {'
  );

  if (source.includes('const immediateEventId = useMemo(() => {') && !source.includes('if (eventId) return eventId;')) {
    source = source.replace(
      "  const immediateEventId = useMemo(() => {\n    const fromResolved = resolvedEvent?.id;",
      "  const immediateEventId = useMemo(() => {\n    if (eventId) return eventId;\n    const fromResolved = resolvedEvent?.id;"
    );
    source = source.replace('  }, [resolvedEvent, musicians]);', '  }, [eventId, resolvedEvent, musicians]);');
  }

  // Delegated members already arrive with canManageSchedule resolved by the parent panel.
  // Do not wait for adminChecked/resolvedEvent/immediateEventId just to paint the action.
  for (const condition of [
    'adminChecked && canEditScale && resolvedEvent?.id',
    'canEditScale && resolvedEvent?.id',
    'canEditScale && immediateEventId',
  ]) {
    source = source.replace(`                  {${condition} ? (`, '                  {canEditScale ? (');
  }

  source = replaceIfPresent(
    source,
    '      {builderOpen && resolvedEvent?.id ? (',
    '      {builderOpen && immediateEventId ? (',
    'builderOpen && immediateEventId ? ('
  );
  source = replaceIfPresent(
    source,
    '              <EventoEscalaTab eventId={resolvedEvent.id}',
    '              <EventoEscalaTab eventId={immediateEventId}',
    'EventoEscalaTab eventId={immediateEventId}'
  );

  return source;
});

console.log('[member scale instant actions] patch concluído.');
