import fs from 'node:fs';

function patchFile(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  let changed = false;

  for (const { oldText, newText, marker, all = false } of replacements) {
    if (marker && source.includes(marker)) continue;
    if (!source.includes(oldText)) {
      throw new Error(`[band notes patch] Trecho esperado não encontrado em ${path}: ${oldText.slice(0, 180)}`);
    }
    source = all ? source.split(oldText).join(newText) : source.replace(oldText, newText);
    changed = true;
  }

  if (changed) fs.writeFileSync(path, source);
  console.log(`[band notes patch] ${path}: ${changed ? 'atualizado' : 'já aplicado'}`);
}

patchFile('lib/membro/membro-invites.js', [
  {
    oldText: `      observations: event?.observations || '',\n      hasSound: meta.hasSound,`,
    newText: `      observations: event?.observations || '',\n      bandNotes: event?.band_notes || '',\n      bandNotesUpdatedAt: event?.band_notes_updated_at || '',\n      bandNotesUpdatedBy: event?.band_notes_updated_by || '',\n      hasSound: meta.hasSound,`,
    marker: 'bandNotesUpdatedAt: event?.band_notes_updated_at',
  },
]);

patchFile('components/membro/MembroEscalasTab.js', [
  {
    oldText: `import { normalizeTimeStrict } from '@/lib/time/normalize-time';`,
    newText: `import { normalizeTimeStrict } from '@/lib/time/normalize-time';\nimport BandNotesButton from '@/components/events/BandNotesButton';`,
    marker: "BandNotesButton from '@/components/events/BandNotesButton'",
  },
  {
    oldText: `  const formationTone = getFormationTone(item?.formation);\n  const agendaVisual = getAgendaVisualMeta(item);`,
    newText: `  const formationTone = getFormationTone(item?.formation);\n  const agendaVisual = getAgendaVisualMeta(item);\n  const canEditBandNotes = member?.isAdmin === true || member?.canManageSchedules === true;\n  const workspaceId = member?.workspaceId || member?.workspace_id || '';`,
    marker: 'const canEditBandNotes = member?.isAdmin',
  },
  {
    oldText: `function EventCard({\n  item,\n  onOpenScale,`,
    newText: `function EventCard({\n  item,\n  member,\n  onOpenScale,`,
    marker: '  member,\n  onOpenScale,',
  },
  {
    oldText: `      <span\n        className={\`mt-3 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-extrabold \${formationTone}\`}\n      >\n        🎼 {item?.formation || '-'}\n      </span>\n\n      <div className="mt-[14px] flex flex-wrap gap-2">`,
    newText: `      <span\n        className={\`mt-3 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-extrabold \${formationTone}\`}\n      >\n        🎼 {item?.formation || '-'}\n      </span>\n\n      <div className="absolute right-[18px] top-[46%] z-10 -translate-y-1/2">\n        <BandNotesButton\n          eventId={item?.eventId}\n          eventName={item?.clientName}\n          eventDate={item?.eventDate}\n          eventTime={item?.eventTime}\n          initialNotes={item?.bandNotes}\n          initialUpdatedAt={item?.bandNotesUpdatedAt}\n          initialUpdatedBy={item?.bandNotesUpdatedBy}\n          canEdit={canEditBandNotes}\n          workspaceId={workspaceId}\n          dark\n        />\n      </div>\n\n      <div className="mt-[14px] flex flex-wrap gap-2">`,
    marker: 'initialNotes={item?.bandNotes}',
  },
  {
    oldText: `              item={item}\n              onOpenScale={onOpenScale}`,
    newText: `              item={item}\n              member={member}\n              onOpenScale={onOpenScale}`,
    marker: '              member={member}\n              onOpenScale={onOpenScale}',
    all: true,
  },
]);

patchFile('components/admin/AdminEventCard.js', [
  {
    oldText: `import Link from 'next/link';`,
    newText: `import Link from 'next/link';\nimport BandNotesButton from '@/components/events/BandNotesButton';`,
    marker: "BandNotesButton from '@/components/events/BandNotesButton'",
  },
  {
    oldText: `          <button\n            type="button"\n            onClick={onOpenEscala}\n            className={\`\${ACTION_BASE_CLASS} bg-violet-600 text-white shadow-[0_10px_24px_rgba(124,58,237,0.25)]\`}\n          >\n            Escala\n          </button>`,
    newText: `          <button\n            type="button"\n            onClick={onOpenEscala}\n            className={\`\${ACTION_BASE_CLASS} bg-violet-600 text-white shadow-[0_10px_24px_rgba(124,58,237,0.25)]\`}\n          >\n            Escala\n          </button>\n\n          <BandNotesButton\n            eventId={id}\n            eventName={cliente}\n            eventDate={event?.event_date || data}\n            eventTime={event?.event_time || hora}\n            initialNotes={event?.band_notes || ''}\n            initialUpdatedAt={event?.band_notes_updated_at || ''}\n            initialUpdatedBy={event?.band_notes_updated_by || ''}\n            canEdit\n            workspaceId={event?.workspace_id || ''}\n            dark={false}\n            compact\n          />`,
    marker: 'initialNotes={event?.band_notes ||',
  },
  {
    oldText: `    prev.observacoes === next.observacoes &&`,
    newText: `    prev.observacoes === next.observacoes &&\n    prev.event?.band_notes === next.event?.band_notes &&\n    prev.event?.band_notes_updated_at === next.event?.band_notes_updated_at &&`,
    marker: 'prev.event?.band_notes === next.event?.band_notes',
  },
]);

patchFile('app/(admin)/eventos/page.js', [
  {
    oldText: `cost_breakdown, costs_source, is_demo, source, metadata';`,
    newText: `cost_breakdown, costs_source, band_notes, band_notes_updated_at, band_notes_updated_by, is_demo, source, metadata';`,
    marker: 'band_notes, band_notes_updated_at, band_notes_updated_by',
  },
]);

console.log('[band notes patch] concluído');
