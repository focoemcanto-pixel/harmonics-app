'use client';

import { useEffect, useMemo, useState } from 'react';

function buildSearchUrl(title) {
  const query = encodeURIComponent(`${String(title || '').trim()} letra`);
  // igu=1 mantém a busca do Google compatível com visualização incorporada quando disponível.
  return `https://www.google.com/search?igu=1&q=${query}`;
}

function buildExternalSearchUrl(title) {
  const query = encodeURIComponent(`${String(title || '').trim()} letra`);
  return `https://www.google.com/search?q=${query}`;
}

export default function LyricsBrowserOverlay({ open, items = [], index = 0, onIndexChange, onClose }) {
  const current = items[index] || null;
  const [loading, setLoading] = useState(true);
  const url = useMemo(() => buildSearchUrl(current?.title || ''), [current?.title]);
  const externalUrl = useMemo(() => buildExternalSearchUrl(current?.title || ''), [current?.title]);

  useEffect(() => {
    if (open) setLoading(true);
  }, [open, index]);

  // Guarda a posição atual antes de sair para um navegador externo. Em iOS/PWA o
  // sistema pode suspender a WebView enquanto o Safari/SFSafariViewController está
  // aberto; quando o usuário volta, o Harmonics continua exatamente na mesma letra.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(
        'harmonics:lyrics-overlay',
        JSON.stringify({ open: true, index, title: current?.title || '', savedAt: Date.now() })
      );
    } catch {}
  }, [open, index, current?.title]);

  if (!open || !current) return null;

  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  function go(delta) {
    const next = Math.max(0, Math.min(items.length - 1, index + delta));
    if (next !== index) onIndexChange?.(next);
  }

  function openExternal() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    try {
      window.sessionStorage.setItem(
        'harmonics:lyrics-overlay',
        JSON.stringify({ open: true, index, title: current?.title || '', savedAt: Date.now() })
      );
    } catch {}

    // No iPhone/PWA, window.open() pode reutilizar a própria WebView e substituir o
    // estado visual do app. Um link real com target=_blank faz o iOS entregar a URL
    // ao navegador externo, mantendo o Harmonics aberto por baixo.
    const anchor = document.createElement('a');
    anchor.href = externalUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer external';
    anchor.setAttribute('aria-hidden', 'true');
    anchor.style.position = 'fixed';
    anchor.style.left = '-9999px';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
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
          <button type="button" onClick={openExternal} aria-label="Abrir no navegador sem sair do Harmonics" title="Abrir no navegador" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border border-white/10 bg-white/5 text-[16px] active:scale-95">↗</button>
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
        A busca abre dentro do Harmonics. Se um site bloquear a exibição, use ↗; ele abre fora e mantém esta letra aberta no app.
      </div>
    </div>
  );
}
