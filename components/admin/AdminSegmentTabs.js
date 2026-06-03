'use client';

import { useEffect, useMemo } from 'react';

function scrollToPageStart() {
  if (typeof window === 'undefined') return;

  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function getUrlTab(paramName) {
  if (typeof window === 'undefined') return '';
  return new URL(window.location.href).searchParams.get(paramName) || '';
}

function writeUrlTab(paramName, key, defaultKey) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (!key || key === defaultKey) {
    url.searchParams.delete(paramName);
  } else {
    url.searchParams.set(paramName, key);
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.pushState({ harmonicsAdminTab: key }, '', nextUrl);
  }
}

export default function AdminSegmentTabs({
  items = [],
  active,
  onChange,
  resetScrollOnChange = true,
  syncWithUrl = true,
  urlParamName = 'tab',
}) {
  const validKeys = useMemo(() => items.map((item) => item.key).filter(Boolean), [items]);
  const defaultKey = validKeys[0] || '';

  useEffect(() => {
    if (!syncWithUrl || !validKeys.length) return undefined;

    const urlTab = getUrlTab(urlParamName);
    if (urlTab && validKeys.includes(urlTab) && urlTab !== active) {
      onChange?.(urlTab);
    }

    function handlePopState() {
      const nextTab = getUrlTab(urlParamName) || defaultKey;
      if (nextTab && validKeys.includes(nextTab)) {
        onChange?.(nextTab);
        if (resetScrollOnChange) scrollToPageStart();
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [active, defaultKey, onChange, resetScrollOnChange, syncWithUrl, urlParamName, validKeys]);

  function handleTabChange(key) {
    onChange?.(key);
    if (syncWithUrl) writeUrlTab(urlParamName, key, defaultKey);
    if (resetScrollOnChange) scrollToPageStart();
  }

  return (
    <nav
      aria-label="Abas da seção"
      className="relative z-0 -mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const selected = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={selected}
            onClick={() => handleTabChange(item.key)}
            className={`shrink-0 touch-manipulation whitespace-nowrap rounded-full px-4 py-2.5 text-[12px] font-black transition active:scale-[0.98] ${
              selected
                ? 'bg-violet-100 text-violet-700 shadow-[0_8px_18px_rgba(124,58,237,0.12)]'
                : 'border border-[#dbe3ef] bg-white text-[#475569]'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
