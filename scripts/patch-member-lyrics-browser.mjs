import fs from 'node:fs';

const path = 'components/membro/MembroRepertorioResumoModal.js';
let source = fs.readFileSync(path, 'utf8');
const before = source;

if (!source.includes("import LyricsBrowserOverlay from './LyricsBrowserOverlay';")) {
  source = source.replace(
    "import { useEffect, useMemo } from 'react';",
    "import { useEffect, useMemo, useState } from 'react';"
  );
  source = source.replace(
    "import EditableMusicalKey from './EditableMusicalKey';",
    "import EditableMusicalKey from './EditableMusicalKey';\nimport LyricsBrowserOverlay from './LyricsBrowserOverlay';"
  );
}

source = source.replace(
  'function RepertorioLinha({ row, index, displayNumber }) {',
  'function RepertorioLinha({ row, index, displayNumber, onOpenLyrics }) {'
);
source = source.replaceAll('onClick={() => openLyricsSearch(title)}', 'onClick={() => onOpenLyrics?.(row)}');

const componentMarker = 'export default function MembroRepertorioResumoModal({ open, item, onClose, onOpenPdf, onOpenPlayer, onGoToRepertorios }) {';
if (source.includes(componentMarker) && !source.includes('const [lyricsIndex, setLyricsIndex] = useState(null);')) {
  source = source.replace(
    componentMarker,
    `${componentMarker}\n  const [lyricsIndex, setLyricsIndex] = useState(null);`
  );
}

const hasPdfMarker = '  const hasPdf = Boolean(item?.repertorioPdfUrl);';
if (source.includes(hasPdfMarker) && !source.includes('const lyricsItems = useMemo')) {
  source = source.replace(
    hasPdfMarker,
    `  const lyricsItems = useMemo(() => {\n    const result = [];\n    (repertorioData?.orderedSections || []).forEach((section) => {\n      (section?.items || []).forEach(({ row, displayNumber }, index) => {\n        result.push({\n          id: String(row?.id || row?.repertoire_item_id || \\`${'${section.key}-${displayNumber || index}'}\\`),\n          row,\n          title: getMainTitle(row, index),\n          subtitle: getSecondaryText(row) || section?.label || '',\n        });\n      });\n    });\n    return result;\n  }, [repertorioData]);\n\n  function handleOpenLyrics(targetRow) {\n    const targetId = String(targetRow?.id || targetRow?.repertoire_item_id || '');\n    let nextIndex = lyricsItems.findIndex((entry) => targetId && String(entry?.id || '') === targetId);\n    if (nextIndex < 0) nextIndex = lyricsItems.findIndex((entry) => entry?.row === targetRow);\n    if (nextIndex >= 0) setLyricsIndex(nextIndex);\n  }\n\n${hasPdfMarker}`
  );
}

source = source.replace(
  /<RepertorioLinha key=\{`\$\{section\.key\}-\$\{row\?\.ordem \|\| row\?\.item_order \|\| index\}-\$\{row\?\.musica \|\| row\?\.song_name \|\| index\}`\} row=\{row\} index=\{index\} displayNumber=\{displayNumber\} \/>/g,
  '<RepertorioLinha key={`${section.key}-${row?.ordem || row?.item_order || index}-${row?.musica || row?.song_name || index}`} row={row} index={index} displayNumber={displayNumber} onOpenLyrics={handleOpenLyrics} />'
);

if (!source.includes('onOpenLyrics={handleOpenLyrics}')) {
  source = source.replace(
    'row={row} index={index} displayNumber={displayNumber} />',
    'row={row} index={index} displayNumber={displayNumber} onOpenLyrics={handleOpenLyrics} />'
  );
}

if (!source.includes('<LyricsBrowserOverlay')) {
  const tail = '    </div>\n  );\n}';
  const tailIndex = source.lastIndexOf(tail);
  if (tailIndex < 0) throw new Error('[member lyrics browser] final do modal não encontrado');
  const replacement = `    </div>\n      <LyricsBrowserOverlay\n        open={lyricsIndex !== null}\n        items={lyricsItems}\n        index={lyricsIndex ?? 0}\n        onIndexChange={setLyricsIndex}\n        onClose={() => setLyricsIndex(null)}\n      />\n    </>\n  );\n}`;
  source = source.slice(0, tailIndex) + replacement + source.slice(tailIndex + tail.length);

  const returnMarker = '  return (\n    <div className="fixed inset-0 z-[180]';
  if (!source.includes(returnMarker)) throw new Error('[member lyrics browser] início do return não encontrado');
  source = source.replace(returnMarker, '  return (\n    <>\n    <div className="fixed inset-0 z-[180]');
}

if (!source.includes('<LyricsBrowserOverlay') || !source.includes('onOpenLyrics={handleOpenLyrics}')) {
  throw new Error('[member lyrics browser] integração incompleta');
}

if (source !== before) fs.writeFileSync(path, source);
console.log(`[member lyrics browser] ${source !== before ? 'aplicado' : 'já aplicado'}`);
