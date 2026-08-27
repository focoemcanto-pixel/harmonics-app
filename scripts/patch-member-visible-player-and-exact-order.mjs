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

  const replacement = `  function buildPlaylistFromRow(item) {\n    if (!Array.isArray(item?.repertorioItems)) return [];\n\n    // Usa exatamente a sequência que já chega no repertório do membro.\n    // O resumo já recebe repertorioItems na ordem salva pelo cliente, então\n    // não reinterpreta momentos nem promove padrinhos/saída artificialmente.\n    return item.repertorioItems\n      .map((row, originalIndex) => ({ row, originalIndex }))\n      .filter(({ row }) => Boolean(resolveTrackUrl(row)))\n      .map(({ row, originalIndex }, index) => {\n        const sectionKey = resolveSectionFromItem(row);\n        return {\n          itemId: row?.id || null,\n          title: row?.musica || row?.song_name || \`Faixa \${index + 1}\`,\n          subtitle: getDisplayLabel(row, sectionKey),\n          notes: row?.observacao || row?.notes || '',\n          videoId: String(row?.reference_video_id || '').trim(),\n          url: resolveTrackUrl(row),\n          order: row?.item_order ?? row?.ordem ?? originalIndex + 1,\n          sectionKey,\n        };\n      });\n  }`;

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
    const injected = `${marker}\n\n  useEffect(() => {\n    let raf = 0;\n    let stopped = false;\n\n    const syncRect = () => {\n      if (stopped) return;\n      const target = document.getElementById('harmonics-visible-player-host');\n      if (target) {\n        const rect = target.getBoundingClientRect();\n        if (rect.width > 20 && rect.height > 20) {\n          setVisibleRect((previous) => {\n            if (previous && Math.abs(previous.left - rect.left) < 1 && Math.abs(previous.top - rect.top) < 1 && Math.abs(previous.width - rect.width) < 1 && Math.abs(previous.height - rect.height) < 1) return previous;\n            return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };\n          });\n        } else {\n          setVisibleRect(null);\n        }\n      } else {\n        setVisibleRect(null);\n      }\n      raf = window.requestAnimationFrame(syncRect);\n    };\n\n    raf = window.requestAnimationFrame(syncRect);\n    return () => {\n      stopped = true;\n      window.cancelAnimationFrame(raf);\n    };\n  }, []);`;
    if (!source.includes(marker)) throw new Error('[member visible player] marker de cleanup não encontrado');
    source = source.replace(marker, injected);
  }

  // No Safari/iPhone o iframe criado pela IFrame API enquanto está fora da tela pode
  // ficar preto mesmo depois de reposicionado. Só instancia o YT.Player depois que
  // existe um slot visível real no modal. Depois de criado, ele pode ser minimizado
  // sem destruir a instância e o áudio continua dentro do app.
  source = source.replace(
    "      if (!YT?.Player || cancelled || !mountNodeRef.current || playerRef) return;",
    "      if (!YT?.Player || cancelled || !mountNodeRef.current || playerRef || !visibleRect || !videoId) return;"
  );

  source = source.replace(
    "        width: '220',\n        height: '124',",
    "        width: String(Math.max(220, Math.round(visibleRect?.width || 220))),\n        height: String(Math.max(124, Math.round(visibleRect?.height || 124))),"
  );

  source = source.replace(
    "          controls: 0,",
    "          controls: 1,"
  );

  // Reexecuta a inicialização quando o slot visível aparece pela primeira vez.
  if (!source.includes('    visibleRect,\n  ]);')) {
    source = source.replace(
      "    retryPlay,\n  ]);",
      "    retryPlay,\n    visibleRect,\n  ]);"
    );
  }

  const returnStart = source.indexOf('  return (\n    <div\n      aria-hidden="true"');
  const altReturnStart = source.indexOf('  return (\n    <div\n      aria-hidden={visibleRect ? undefined');
  const actualReturnStart = returnStart === -1 ? altReturnStart : returnStart;
  if (actualReturnStart === -1) throw new Error('[member visible player] return host não encontrado');
  const returnEnd = source.indexOf('\n  );\n}', actualReturnStart);
  if (returnEnd === -1) throw new Error('[member visible player] fim return host não encontrado');

  const nextReturn = `  return (\n    <div\n      aria-hidden={visibleRect ? undefined : 'true'}\n      style={{\n        position: 'fixed',\n        left: visibleRect ? visibleRect.left : -10000,\n        top: visibleRect ? visibleRect.top : 0,\n        width: visibleRect ? visibleRect.width : 220,\n        height: visibleRect ? visibleRect.height : 124,\n        opacity: visibleRect ? 1 : 0.01,\n        pointerEvents: visibleRect ? 'auto' : 'none',\n        overflow: 'hidden',\n        zIndex: visibleRect ? 190 : 0,\n        borderRadius: visibleRect ? 18 : 0,\n        background: '#000',\n      }}\n    >\n      <div ref={mountNodeRef} style={{ width: '100%', height: '100%' }} />\n    </div>\n  );`;

  source = source.slice(0, actualReturnStart) + nextReturn + source.slice(returnEnd + '\n  );'.length);

  if (!source.includes('playerRef?.setSize?.(visibleRect.width, visibleRect.height)')) {
    const effectMarker = "  useEffect(() => {\n    if (!playerRef || desiredPlaybackState !== 'playing') return undefined;";
    const resizeEffect = `  useEffect(() => {\n    if (!playerRef || !visibleRect) return;\n    playerRef?.setSize?.(visibleRect.width, visibleRect.height);\n  }, [playerRef, visibleRect]);\n\n${effectMarker}`;
    if (!source.includes(effectMarker)) throw new Error('[member visible player] marker resize não encontrado');
    source = source.replace(effectMarker, resizeEffect);
  }

  return source;
});

console.log('[member visible player] ordem do repertório + iframe YouTube visível/safari-safe aplicados');
