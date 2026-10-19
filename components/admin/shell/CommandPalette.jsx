'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import NavIcon from '@/components/admin/shell/NavIcon';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Busca rápida entre as telas permitidas (Ctrl/⌘+K). Só navega: não consulta dados.
export default function CommandPalette({ open, onClose, sections = [], onNavigate, onPrefetch }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  const entries = useMemo(() => sections.flatMap((section) => section.items.flatMap((item) => {
    const base = [{ key: item.href, label: item.label, href: item.href, icon: item.icon, context: section.label }];
    const children = (item.children || [])
      .filter((child) => child.href !== item.href)
      .map((child) => ({ key: child.href, label: child.label, href: child.href, icon: item.icon, context: item.label }));
    return [...base, ...children];
  })), [sections]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return entries;
    // Relevância: começo do nome > começo de palavra > qualquer trecho (nome ou seção).
    const score = (entry) => {
      const label = normalize(entry.label);
      if (label.startsWith(q)) return 0;
      if (label.split(/[\s-]+/).some((word) => word.startsWith(q))) return 1;
      if (label.includes(q)) return 2;
      return normalize(entry.context).includes(q) ? 3 : -1;
    };
    return entries
      .map((entry) => ({ entry, rank: score(entry) }))
      .filter((item) => item.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .map((item) => item.entry);
  }, [entries, query]);

  // Montado só enquanto aberto: cada abertura começa com busca vazia.
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const current = results[cursor];
    if (open && current) onPrefetch?.(current.href);
  }, [cursor, onPrefetch, open, results]);

  if (!open) return null;

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => Math.min(results.length - 1, value + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => Math.max(0, value - 1));
    } else if (event.key === 'Enter' && results[cursor]) {
      event.preventDefault();
      onNavigate?.(results[cursor].href);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ir para tela"
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/30 px-4 pt-[calc(env(safe-area-inset-top,0px)+12vh)] backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose?.()}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-[var(--hx-radius-xl)] border border-[var(--hx-border)] bg-[var(--hx-surface)] shadow-[var(--hx-shadow-lg)]">
        <div className="flex items-center gap-3 border-b border-[var(--hx-border)] px-4">
          <Search size={18} className="text-[var(--hx-text-3)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setCursor(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar tela: eventos, contratos, financeiro…"
            className="h-14 flex-1 bg-transparent text-[15px] text-[var(--hx-text)] outline-none placeholder:text-[var(--hx-text-3)]"
            aria-label="Buscar tela"
          />
          <kbd className="hidden rounded-md border border-[var(--hx-border)] px-1.5 py-0.5 font-sans text-[11px] text-[var(--hx-text-3)] sm:inline">Esc</kbd>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-[13px] text-[var(--hx-text-3)]">Nenhuma tela encontrada.</li>
          ) : results.map((entry, index) => (
            <li key={entry.key} role="option" aria-selected={index === cursor}>
              <button
                type="button"
                onMouseEnter={() => setCursor(index)}
                onClick={() => onNavigate?.(entry.href)}
                className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors ${index === cursor ? 'bg-[var(--hx-surface-2)]' : ''}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--hx-border)] bg-[var(--hx-surface)] text-[var(--hx-text-2)]">
                  <NavIcon name={entry.icon} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[var(--hx-text)]">{entry.label}</span>
                  <span className="block truncate text-[12px] text-[var(--hx-text-3)]">{entry.context}</span>
                </span>
                {index === cursor ? <CornerDownLeft size={15} className="text-[var(--hx-text-3)]" aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
