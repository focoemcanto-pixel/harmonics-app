'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function scrollToPageStart() {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function readTabFromLocation(paramName, allowedTabs, fallback) {
  if (typeof window === 'undefined') return fallback;
  const value = new URL(window.location.href).searchParams.get(paramName) || '';
  return allowedTabs.includes(value) ? value : fallback;
}

function writeTabToHistory(paramName, tab, fallback, mode = 'push') {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (!tab || tab === fallback) url.searchParams.delete(paramName);
  else url.searchParams.set(paramName, tab);

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) return;

  const state = { harmonicsAdminMobileTab: tab || fallback };
  if (mode === 'replace') window.history.replaceState(state, '', nextUrl);
  else window.history.pushState(state, '', nextUrl);
}

export default function useAdminMobileTabs({
  tabs = [],
  defaultTab,
  urlParamName = 'tab',
  syncWithUrl = true,
  resetScrollOnChange = true,
} = {}) {
  const searchParams = useSearchParams();
  const allowedTabs = useMemo(
    () => tabs.map((item) => (typeof item === 'string' ? item : item?.key)).filter(Boolean),
    [tabs]
  );
  const fallback = defaultTab || allowedTabs[0] || '';

  const [activeTab, setActiveTabState] = useState(() => {
    if (!syncWithUrl) return fallback;
    return readTabFromLocation(urlParamName, allowedTabs, fallback);
  });

  useEffect(() => {
    if (!syncWithUrl || !allowedTabs.length) return undefined;
    const nextTab = readTabFromLocation(urlParamName, allowedTabs, fallback);
    const timer = window.setTimeout(() => {
      setActiveTabState((current) => (current === nextTab ? current : nextTab));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [allowedTabs, fallback, searchParams, syncWithUrl, urlParamName]);

  useEffect(() => {
    if (!syncWithUrl || !allowedTabs.length) return undefined;

    function handlePopState() {
      const nextTab = readTabFromLocation(urlParamName, allowedTabs, fallback);
      setActiveTabState(nextTab);
      if (resetScrollOnChange) scrollToPageStart();
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [allowedTabs, fallback, resetScrollOnChange, syncWithUrl, urlParamName]);

  const setActiveTab = useCallback(
    (nextTab, options = {}) => {
      const normalizedTab = allowedTabs.includes(nextTab) ? nextTab : fallback;
      setActiveTabState(normalizedTab);

      if (syncWithUrl) {
        writeTabToHistory(
          urlParamName,
          normalizedTab,
          fallback,
          options.replace ? 'replace' : 'push'
        );
      }

      if (options.scroll !== false && resetScrollOnChange) scrollToPageStart();
    },
    [allowedTabs, fallback, resetScrollOnChange, syncWithUrl, urlParamName]
  );

  return {
    activeTab,
    setActiveTab,
    isActive(tab) {
      return activeTab === tab;
    },
  };
}
