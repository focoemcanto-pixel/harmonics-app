'use client';

import { useEffect } from 'react';

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

function isAutomationLogModalPre(pre) {
  if (!(pre instanceof HTMLElement)) return false;
  const modal = pre.closest('[role="dialog"], .fixed.inset-0');
  if (!modal) return false;

  const text = String(pre.textContent || '');
  return text.length > 900;
}

function clampPre(pre) {
  if (!(pre instanceof HTMLElement)) return;
  if (pre.dataset.mobilePayloadGuard === 'true') return;
  if (!isAutomationLogModalPre(pre)) return;

  pre.dataset.mobilePayloadGuard = 'true';
  pre.dataset.expanded = 'false';
  pre.style.maxHeight = '180px';
  pre.style.overflow = 'auto';
  pre.style.webkitOverflowScrolling = 'touch';
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.wordBreak = 'break-word';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Expandir payload';
  toggle.className = 'mt-2 rounded-full border border-slate-200 px-3 py-1 text-[12px] font-bold text-slate-600';

  toggle.addEventListener('click', () => {
    const expanded = pre.dataset.expanded === 'true';
    pre.dataset.expanded = expanded ? 'false' : 'true';
    pre.style.maxHeight = expanded ? '180px' : '70vh';
    toggle.textContent = expanded ? 'Expandir payload' : 'Recolher payload';
  });

  pre.insertAdjacentElement('afterend', toggle);
}

export default function MobileLogsPayloadGuard() {
  useEffect(() => {
    if (!isMobileViewport()) return undefined;

    const scan = () => {
      document.querySelectorAll('pre').forEach(clampPre);
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
