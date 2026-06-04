'use client';

import { useEffect } from 'react';

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

function findScaleEventHref(target) {
  const clicked = target instanceof Element ? target : null;
  if (!clicked) return '';

  const button = clicked.closest('button');
  if (!button) return '';

  const label = String(button.textContent || '').trim().toLowerCase();
  if (label !== 'montar escala') return '';

  const card = button.closest('.rounded-\[26px\]') || button.parentElement?.parentElement;
  const anchor = card?.querySelector?.('a[href^="/eventos/"][href*="tab=escala"]');
  const href = anchor?.getAttribute?.('href') || '';

  return href;
}

export default function MobileScaleWorkspaceGuard() {
  useEffect(() => {
    function handleClick(event) {
      if (!isMobileViewport()) return;

      const href = findScaleEventHref(event.target);
      if (!href) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      window.location.assign(href);
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return null;
}
