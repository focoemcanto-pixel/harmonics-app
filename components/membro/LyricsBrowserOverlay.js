'use client';

import { useEffect, useMemo, useState } from 'react';

function buildSearchUrl(title) {
  const query = encodeURIComponent(`${String(title || '').trim()} letra`);
  // igu=1 mantém a busca do Google compatível com visualização incorporada quando disponível.
  return `https://www.google.com/search?igu=1&q=${query}`;
}

export default function LyricsBrowserOverlay({ open, items = [], index = 0, onIndexChange, onClose }) {
  const current = items[index] || null;
  const [loading, setLoading] = useState(true);
  const url = useMemo(() => buildSearchUrl(current?.title || ''), [current?.title]);

  useEffect(() => {
    if (open) setLoading(true);
  }, [open, index]);

  if (!open || !current) return null;

  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  function go(delta) {
    const next = Math.max(0, Math.min(items.length - 1, index + delta));
    if (next !== index) onIndexChange?.(next);
  }

  function openExternal() {
    if (typeof window === 'undefined') return;
    window.open(url.replace('igu=1&', ''), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="fixed inset-0 z-[260] flex h-[100dvh] flex-col bg-[#090611] text-white">
      <div className="shrink-0 border-b border-white/10 bg-[#140d26] px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} aria-label="Voltar ao repertório" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-white/10 bg-white/5 text-[19px] font-black active:scale-95">‹</button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">Letra • {index + 1} de {items.length}</div>
            <div className="mt-0.5 truncate text-[14px] font-black text-white">{current.title}</div>
            {current.subtitle ? <div className="mt-0.5 truncate text-[11px] font-semibold text-white/45">{current.subtitle}</div> : null}
          </div>
          <button type="button" onClick={openExternal} aria-label="Abrir no navegador" title="Abrir no navegador" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-white/10 bg-white/5 text-[16px] active:scale-95">↗</button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={!hasPrev} onClick={() => go(-1)} className="min-h-10 rounded-[12px] border border-violet-300/15 bg-violet-400/10 px-3 text-[12px] font-black text-violet-100 disabled:opacity-30">← Música anterior</button>
          <button type="button" disabled={!hasNext} onClick={() => go(1)} className="min-h-10 rounded-[12px] border border-violet-300/15 bg-violet-400/10 px-3 text-[12px] font-black text-violet-100 disabled:opacity-30">Próxima música →</button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        {loading ? (
          <div className="absolute inset-x-0 top-0 z-10 h-1 overflow-hidden bg-violet-100">
            <div className="h-full w-1/3 animate-[pulse_0.8s_ease-in-out_infinite] bg-violet-600" />
          </div>
        ) : null}
        <iframe
          key={`${index}-${url}`}
          src={url}
          title={`Letra de ${current.title}`}
          onLoad={() => setLoading(false)}
          className="h-full w-full border-0 bg-white"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="clipboard-read; clipboard-write"
        />
      </div>

      <div className="shrink-0 border-t border-white/10 bg-[#140d26] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2 text-center text-[10px] font-semibold leading-4 text-white/40">
        A busca abre dentro do Harmonics. Alguns sites podem impedir exibição incorporada; nesse caso use ↗ sem perder a posição no repertório.
      </div>
    </div>
  );
}
