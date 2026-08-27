import fs from 'node:fs';

function patch(path, mutate) {
  let source = fs.readFileSync(path, 'utf8');
  const before = source;
  source = mutate(source);
  if (source !== before) fs.writeFileSync(path, source);
  console.log(`[member visible player] ${path}: ${source !== before ? 'atualizado' : 'já aplicado/compatível'}`);
}

patch('app/membro/page.js', (source) => {
  const start = source.indexOf('  function buildPlaylistFromRow(item) {');
  const end = source.indexOf('\n\n  function openRepertoire(item, options = {}) {', start);
  if (start === -1 || end === -1) throw new Error('[member visible player] buildPlaylistFromRow não encontrado');

  const replacement = `  function buildPlaylistFromRow(item) {\n    if (!Array.isArray(item?.repertorioItems)) return [];\n\n    // Usa exatamente a sequência que já chega no repertório do membro.\n    return item.repertorioItems\n      .map((row, originalIndex) => ({ row, originalIndex }))\n      .filter(({ row }) => Boolean(resolveTrackUrl(row)))\n      .map(({ row, originalIndex }, index) => {\n        const sectionKey = resolveSectionFromItem(row);\n        return {\n          itemId: row?.id || null,\n          title: row?.musica || row?.song_name || \`Faixa \${index + 1}\`,\n          subtitle: getDisplayLabel(row, sectionKey),\n          notes: row?.observacao || row?.notes || '',\n          videoId: String(row?.reference_video_id || '').trim(),\n          url: resolveTrackUrl(row),\n          order: row?.item_order ?? row?.ordem ?? originalIndex + 1,\n          sectionKey,\n        };\n      });\n  }`;

  return source.slice(0, start) + replacement + source.slice(end);
});

patch('components/membro/MembroPlayerModal.js', (source) => {
  const oldFrame = `<YoutubePlaybackFrame title={currentTrack?.title} isPlaying={isPlaying} thumbnailUrl={thumbnailUrl} onTogglePlay={onTogglePlay} />`;
  const newFrame = `<div className="relative aspect-video w-full overflow-hidden rounded-[18px] border border-white/10 bg-black">\n                <div id="harmonics-visible-player-host" className="absolute inset-0" />\n                {!videoId ? (\n                  <div className="absolute inset-0 flex items-center justify-center px-5 text-center text-[13px] font-semibold text-white/60">Referência do YouTube indisponível.</div>\n                ) : null}\n              </div>`;
  source = source.replaceAll(oldFrame, newFrame);
  return source;
});

patch('components/player/GlobalPlayerHostFixed.jsx', (source) => {
  // A implementação V3 já corrige o loop do iframe no Safari/iPhone e os estados
  // de play/pause com refs atualizadas. Não reaplicar o patch legado por cima dela.
  if (source.includes('HARMONICS_STABLE_HOST_V3')) return source;

  if (!source.includes("const [visibleRect, setVisibleRect]")) {
    source = source.replace(
      "import { useCallback, useEffect, useRef } from 'react';",
      "import { useCallback, useEffect, useRef, useState } from 'react';"
    );
    source = source.replace(
      "  const mountNodeRef = useRef(null);",
      "  const mountNodeRef = useRef(null);\n  const [visibleRect, setVisibleRect] = useState(null);"
    );
  }

  return source;
});

console.log('[member visible player] ordem do repertório + player estável preservados');
