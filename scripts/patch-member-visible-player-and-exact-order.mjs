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

  const replacement = `  function buildPlaylistFromRow(item) {\n    if (!Array.isArray(item?.repertorioItems)) return [];\n\n    // Replica exatamente a mesma ordem exibida no resumo do repertório:\n    // seção primeiro, depois item_order/ordem dentro da seção.\n    const sectionRank = { antessala: 0, cortejo: 1, cerimonia: 2, saida: 3, receptivo: 4 };\n    const normalizePlayerSection = (row = {}) => {\n      const raw = String(row?.section || row?.tipo || row?.type || '')\n        .normalize('NFD')\n        .replace(/[\\u0300-\\u036f]/g, '')\n        .toLowerCase()\n        .trim();\n      if (raw.includes('antessala') || raw.includes('antesala') || raw.includes('ante_room')) return 'antessala';\n      if (raw.includes('cortejo') || raw.includes('entrada')) return 'cortejo';\n      if (raw.includes('cerimonia')) return 'cerimonia';\n      if (raw.includes('saida')) return 'saida';\n      if (raw.includes('receptivo') || raw.includes('recepcao')) return 'receptivo';\n      return 'cerimonia';\n    };\n\n    const rows = item.repertorioItems\n      .map((row, originalIndex) => ({\n        row,\n        originalIndex,\n        sectionKey: normalizePlayerSection(row),\n        savedOrder: Number(row?.item_order ?? row?.ordem ?? originalIndex + 1),\n      }))\n      .filter(({ row }) => Boolean(resolveTrackUrl(row)))\n      .sort((a, b) => {\n        const sectionDiff = (sectionRank[a.sectionKey] ?? 99) - (sectionRank[b.sectionKey] ?? 99);\n        if (sectionDiff !== 0) return sectionDiff;\n        if (a.savedOrder !== b.savedOrder) return a.savedOrder - b.savedOrder;\n        return a.originalIndex - b.originalIndex;\n      });\n\n    return rows.map((entry, index) => {\n      const row = entry.row;\n      return {\n        itemId: row?.id || null,\n        title: row?.musica || row?.song_name || \`Faixa \${index + 1}\`,\n        subtitle: getDisplayLabel(row, entry.sectionKey === 'saida' ? 'saida_dos_noivos' : entry.sectionKey),\n        notes: row?.observacao || row?.notes || '',\n        videoId: String(row?.reference_video_id || '').trim(),\n        url: resolveTrackUrl(row),\n        order: entry.savedOrder,\n        sectionKey: entry.sectionKey,\n      };\n    });\n  }`;

  return source.slice(0, start) + replacement + source.slice(end);
});

patch('components/membro/MembroPlayerModal.js', (source) => {
  const oldFrame = `<YoutubePlaybackFrame title={currentTrack?.title} isPlaying={isPlaying} thumbnailUrl={thumbnailUrl} onTogglePlay={onTogglePlay} />`;
  const newFrame = `<div className="relative aspect-video w-full overflow-hidden rounded-[18px] border border-white/10 bg-black">\n                <div id="harmonics-visible-player-host" className="absolute inset-0" />\n                {!videoId ? (\n                  <div className="absolute inset-0 flex items-center justify-center px-5 text-center text-[13px] font-semibold text-white/60">Referência do YouTube indisponível.</div>\n                ) : null}\n              </div>`;
  source = source.replaceAll(oldFrame, newFrame);
  return source;
});

patch('components/player/GlobalPlayerHostFixed.jsx', (source) => {
  if (!source.includes("const [visibleRect, setVisibleRect]")) {
    source = source.replace(
      "import { useCallback, useEffect, useRef } from 'react';",
      "import { useCallback, useEffect, useRef, useState } from 'react';"
    );
    source = source.replace(
      "  const mountNodeRef = useRef(null);",
      "  const mountNodeRef = useRef(null);\n  const [visibleRect, setVisibleRect] = useState(null);"
    );

    const marker = "  useEffect(() => () => {\n    clearRetries();\n  }, [clearRetries]);";
    const injected = `${marker}\n\n  useEffect(() => {\n    let raf = 0;\n    let stopped = false;\n\n    const syncRect = () => {\n      if (stopped) return;\n      const target = document.getElementById('harmonics-visible-player-host');\n      if (target) {\n        const rect = target.getBoundingClientRect();\n        if (rect.width > 20 && rect.height > 20) {\n          setVisibleRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });\n        } else {\n          setVisibleRect(null);\n        }\n      } else {\n        setVisibleRect(null);\n      }\n      raf = window.requestAnimationFrame(syncRect);\n    };\n\n    raf = window.requestAnimationFrame(syncRect);\n    return () => {\n      stopped = true;\n      window.cancelAnimationFrame(raf);\n    };\n  }, []);`;
    if (!source.includes(marker)) throw new Error('[member visible player] marker de cleanup não encontrado');
    source = source.replace(marker, injected);
  }

  const returnStart = source.indexOf('  return (\n    <div\n      aria-hidden="true"');
  if (returnStart === -1) throw new Error('[member visible player] return host não encontrado');
  const returnEnd = source.indexOf('\n  );\n}', returnStart);
  if (returnEnd === -1) throw new Error('[member visible player] fim return host não encontrado');

  const nextReturn = `  return (\n    <div\n      aria-hidden={visibleRect ? undefined : 'true'}\n      style={{\n        position: 'fixed',\n        left: visibleRect ? visibleRect.left : -10000,\n        top: visibleRect ? visibleRect.top : 0,\n        width: visibleRect ? visibleRect.width : 220,\n        height: visibleRect ? visibleRect.height : 124,\n        opacity: visibleRect ? 1 : 0.01,\n        pointerEvents: visibleRect ? 'auto' : 'none',\n        overflow: 'hidden',\n        zIndex: visibleRect ? 190 : 0,\n        borderRadius: visibleRect ? 18 : 0,\n        background: '#000',\n      }}\n    >\n      <div ref={mountNodeRef} style={{ width: '100%', height: '100%' }} />\n    </div>\n  );`;

  source = source.slice(0, returnStart) + nextReturn + source.slice(returnEnd + '\n  );'.length);

  // O iframe criado pelo YT precisa acompanhar o tamanho do slot visível.
  if (!source.includes('playerRef?.setSize?.(visibleRect.width, visibleRect.height)')) {
    const effectMarker = "  useEffect(() => {\n    if (!playerRef || desiredPlaybackState !== 'playing') return undefined;";
    const resizeEffect = `  useEffect(() => {\n    if (!playerRef || !visibleRect) return;\n    playerRef?.setSize?.(visibleRect.width, visibleRect.height);\n  }, [playerRef, visibleRect]);\n\n${effectMarker}`;
    if (!source.includes(effectMarker)) throw new Error('[member visible player] marker resize não encontrado');
    source = source.replace(effectMarker, resizeEffect);
  }

  return source;
});

console.log('[member visible player] ordem idêntica ao repertório + YouTube visível aplicados');
