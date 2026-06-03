'use client';

import { useEffect, useMemo, useRef } from 'react';

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

function writeUrlTab(paramName, key, defaultKey, { replace = false } = {}) {
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
    const state = { harmonicsAdminTab: key || defaultKey };
    if (replace) window.history.replaceState(state, '', nextUrl);
    else window.history.pushState(state, '', nextUrl);
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
  const initializedFromUrlRef = useRef(false);
  const lastInteractionRef = useRef('external');
  const validKeys = useMemo(() => items.map((item) => item.key).filter(Boolean), [items]);
  const defaultKey = validKeys[0] || '';

  useEffect(() => {
    if (!syncWithUrl || !validKeys.length || initializedFromUrlRef.current) return;

    initializedFromUrlRef.current = true;
    const urlTab = getUrlTab(urlParamName);
    if (urlTab && validKeys.includes(urlTab) && urlTab !== active) {
      lastInteractionRef.current = 'url';
      onChange?.(urlTab);
    }
  }, [active, onChange, syncWithUrl, urlParamName, validKeys]);

  useEffect(() => {
    if (!syncWithUrl || !validKeys.length) return undefined;

    function handlePopState() {
      const nextTab = getUrlTab(urlParamName) || defaultKey;
      if (nextTab && validKeys.includes(nextTab)) {
        lastInteractionRef.current = 'popstate';
        onChange?.(nextTab);
        if (resetScrollOnChange) scrollToPageStart();
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [defaultKey, onChange, resetScrollOnChange, syncWithUrl, urlParamName, validKeys]);

  useEffect(() => {
    if (!syncWithUrl || !validKeys.length || !active || !validKeys.includes(active)) return;
    if (!initializedFromUrlRef.current) return;

    const urlTab = getUrlTab(urlParamName) || defaultKey;
    if (urlTab === active) return;

    const shouldReplace = lastInteractionRef.current === 'url' || lastInteractionRef.current === 'popstate';
    writeUrlTab(urlParamName, active, defaultKey, { replace: shouldReplace });
    lastInteractionRef.current = 'external';
  }, [active, defaultKey, syncWithUrl, urlParamName, validKeys]);

  function handleTabChange(key) {
    lastInteractionRef.current = 'click';
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
