import fs from 'node:fs';

function patch(path, mutate) {
  let source = fs.readFileSync(path, 'utf8');
  const before = source;
  source = mutate(source);
  if (source !== before) fs.writeFileSync(path, source);
  console.log(`[member player final] ${path}: ${source !== before ? 'atualizado' : 'já aplicado/compatível'}`);
}

patch('app/membro/page.js', (source) => {
  const start = source.indexOf('  function buildPlaylistFromRow(item) {');
  const end = source.indexOf('\n\n  function openRepertoire(item, options = {}) {', start);
  if (start === -1 || end === -1) {
    throw new Error('[member player final] buildPlaylistFromRow/openRepertoire não encontrados');
  }

  const buildPlaylist = `  function buildPlaylistFromRow(item) {\n    if (!Array.isArray(item?.repertorioItems)) return [];\n\n    // A ordem do player precisa ser exatamente a ordem salva pelo cliente/admin.\n    // Não reinterpretamos padrinhos/noiva/pais, porque isso alterava a sequência real.\n    const orderedRows = item.repertorioItems\n      .map((row, originalIndex) => ({\n        row,\n        originalIndex,\n        savedOrder: Number(row?.item_order ?? row?.ordem ?? originalIndex + 1),\n      }))\n      .filter(({ row }) => Boolean(resolveTrackUrl(row)))\n      .sort((a, b) => {\n        if (a.savedOrder !== b.savedOrder) return a.savedOrder - b.savedOrder;\n        return a.originalIndex - b.originalIndex;\n      });\n\n    return orderedRows.map((entry, index) => {\n      const row = entry.row;\n      const sectionKey = resolveSectionFromItem(row);\n      return {\n        itemId: row?.id || null,\n        title: row?.musica || row?.song_name || \`Faixa \${index + 1}\`,\n        subtitle: getDisplayLabel(row, sectionKey),\n        notes: row?.observacao || row?.notes || '',\n        videoId: String(row?.reference_video_id || '').trim(),\n        url: resolveTrackUrl(row),\n        order: entry.savedOrder,\n        sectionKey,\n      };\n    });\n  }`;

  source = source.slice(0, start) + buildPlaylist + source.slice(end);

  const openStart = source.indexOf('  function openRepertoire(item, options = {}) {');
  const openEnd = source.indexOf('\n\n  function handleMinimizePlayer()', openStart);
  if (openStart === -1 || openEnd === -1) {
    throw new Error('[member player final] openRepertoire/handleMinimizePlayer não encontrados');
  }

  const openRepertoire = `  function openRepertoire(item, options = {}) {\n    if (!item) return;\n\n    const playlist = buildPlaylistFromRow(item);\n    if (!playlist.length) {\n      toast.info('Este repertório não possui faixas com referência de áudio.');\n      return;\n    }\n\n    let startIndex = Number.isFinite(options.startIndex) ? Number(options.startIndex) : 0;\n    if (options.startItemId) {\n      const byId = playlist.findIndex((track) => String(track?.itemId || '') === String(options.startItemId));\n      if (byId >= 0) startIndex = byId;\n    } else if (options.startOrder != null) {\n      const byOrder = playlist.findIndex((track) => Number(track?.order) === Number(options.startOrder));\n      if (byOrder >= 0) startIndex = byOrder;\n    }\n\n    startIndex = Math.max(0, Math.min(startIndex, playlist.length - 1));\n    const shouldAutoplay = options.autoplay === true;\n\n    replacePlaylist(playlist, { autoplay: shouldAutoplay, startIndex });\n    setPlayerEventTitle(item?.clientName || 'Repertório');\n    setIsPlayerModalOpen(options.openModal !== false);\n    setIsMiniPlayerVisible(false);\n  }`;

  source = source.slice(0, openStart) + openRepertoire + source.slice(openEnd);

  if (!source.includes('onOpenTrack={(item, row) => {')) {
    const marker = `        onOpenPlayer={(item) => {\n          setRepertorioResumoOpen(false);\n          openRepertoire(item, { autoplay: false, source: 'repertoire_summary_modal' });\n        }}`;
    const replacement = `${marker}\n        onOpenTrack={(item, row) => {\n          setRepertorioResumoOpen(false);\n          openRepertoire(item, {\n            autoplay: true,\n            startItemId: row?.id || null,\n            startOrder: row?.item_order ?? row?.ordem ?? null,\n            source: 'repertoire_track_direct',\n          });\n        }}`;
    if (!source.includes(marker)) throw new Error('[member player final] onOpenPlayer do resumo não encontrado');
    source = source.replace(marker, replacement);
  }

  return source;
});

patch('components/membro/MembroRepertorioResumoModal.js', (source) => {
  source = source.replace(
    'function RepertorioLinha({ row, index, displayNumber }) {',
    'function RepertorioLinha({ row, index, displayNumber, onOpenTrack }) {'
  );

  const oldTitle = '<div className="min-w-0 flex-1 break-words text-[17px] font-black text-white">{title}</div>';
  const newTitle = `<button\n              type="button"\n              onClick={() => onOpenTrack?.(row)}\n              disabled={!resolveTrackUrl(row)}\n              className="min-w-0 flex-1 break-words text-left text-[17px] font-black text-white underline-offset-4 transition enabled:active:scale-[0.99] disabled:cursor-default"\n              title={resolveTrackUrl(row) ? 'Abrir esta música no player' : undefined}\n            >\n              {title}\n            </button>`;
  if (source.includes(oldTitle)) source = source.replace(oldTitle, newTitle);

  source = source.replace(
    'export default function MembroRepertorioResumoModal({ open, item, onClose, onOpenPdf, onOpenPlayer, onGoToRepertorios }) {',
    'export default function MembroRepertorioResumoModal({ open, item, onClose, onOpenPdf, onOpenPlayer, onOpenTrack, onGoToRepertorios }) {'
  );

  source = source.replace(
    'row={row} index={index} displayNumber={displayNumber} />',
    'row={row} index={index} displayNumber={displayNumber} onOpenTrack={(selectedRow) => onOpenTrack?.(item, selectedRow)} />'
  );

  return source;
});

patch('components/player/GlobalPlayerHost.jsx', (source) => {
  // YouTube iframe dentro de display:none fica com dimensão zero e em Safari/iOS\n  // pode aceitar o clique no controle mas nunca iniciar o vídeo. Mantemos o host\n  // fora da tela, porém renderizado com dimensão válida para a IFrame API.\n  source = source.replace(
    `  return (\n    <div className="hidden" aria-hidden="true">\n      <div ref={mountNodeRef} />\n    </div>\n  );`,
    `  return (\n    <div\n      className="pointer-events-none fixed left-[-10000px] top-0 h-[180px] w-[240px] overflow-hidden opacity-[0.01]"\n      aria-hidden="true"\n    >\n      <div ref={mountNodeRef} className="h-[180px] w-[240px]" />\n    </div>\n  );`
  );
  return source;
});

console.log('[member player final] correções de ordem, faixa direta e reprodução concluídas');
