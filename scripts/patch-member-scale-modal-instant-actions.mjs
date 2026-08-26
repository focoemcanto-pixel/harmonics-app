import fs from 'node:fs';

const path = 'components/membro/MembroEscalaModal.js';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

function replaceIfPresent(oldText, newText, marker) {
  if (marker && source.includes(marker)) return;
  if (!source.includes(oldText)) {
    console.log(`[member scale instant actions] trecho já transformado ou indisponível: ${oldText.slice(0, 100)}`);
    return;
  }
  source = source.replace(oldText, newText);
  changed = true;
}

replaceIfPresent(
  '  const hasScale = displayedMusicians.length > 0;\n  const canEditScale = isAdmin || canManageSchedule;',
  "  const hasScale = displayedMusicians.length > 0;\n  const canEditScale = isAdmin || canManageSchedule;\n  const immediateEventId = useMemo(() => {\n    const fromResolved = resolvedEvent?.id;\n    if (fromResolved) return fromResolved;\n    const sourceRows = Array.isArray(musicians) ? musicians : [];\n    const row = sourceRows.find((item) => item?.event_id || item?.event?.id);\n    return row?.event_id || row?.event?.id || null;\n  }, [resolvedEvent, musicians]);",
  'const immediateEventId = useMemo(() => {'
);

replaceIfPresent(
  '                  {adminChecked && canEditScale && resolvedEvent?.id ? (',
  '                  {canEditScale && immediateEventId ? (',
  'canEditScale && immediateEventId ? ('
);

replaceIfPresent(
  '                  {canEditScale && resolvedEvent?.id ? (',
  '                  {canEditScale && immediateEventId ? (',
  'canEditScale && immediateEventId ? ('
);

replaceIfPresent(
  '      {builderOpen && resolvedEvent?.id ? (',
  '      {builderOpen && immediateEventId ? (',
  'builderOpen && immediateEventId ? ('
);

replaceIfPresent(
  '              <EventoEscalaTab eventId={resolvedEvent.id} />',
  '              <EventoEscalaTab eventId={immediateEventId} />',
  'EventoEscalaTab eventId={immediateEventId}'
);

if (changed) fs.writeFileSync(path, source);
console.log(`[member scale instant actions] ${changed ? 'corrigido' : 'já aplicado/compatível'}`);
