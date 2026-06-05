'use client';

import { useEffect } from 'react';

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isScaleActionButton(button) {
  const label = normalizeText(button?.textContent);
  return label === 'escala' || label === 'montar escala' || label.includes('montar escala');
}

function findNearestEventHref(button) {
  if (!button) return '';

  const knownAnchor = button.closest('a[href^="/eventos/"]');
  if (knownAnchor?.getAttribute) return knownAnchor.getAttribute('href') || '';

  const candidateContainers = [
    button.closest('article'),
    button.closest('[data-event-id]'),
    button.closest('[class*="rounded"]'),
    button.parentElement?.parentElement,
    button.parentElement?.parentElement?.parentElement,
  ].filter(Boolean);

  for (const container of candidateContainers) {
    const directScaleAnchor = container.querySelector?.('a[href^="/eventos/"][href*="tab=escala"]');
    if (directScaleAnchor?.getAttribute) return directScaleAnchor.getAttribute('href') || '';

    const eventAnchor = container.querySelector?.('a[href^="/eventos/"]');
    const href = eventAnchor?.getAttribute?.('href') || '';
    if (href && !href.includes('/novo')) {
      const [path] = href.split('?');
      return `${path}?tab=escala`;
    }
  }

  const eventId = button.dataset?.eventId || button.closest('[data-event-id]')?.dataset?.eventId || '';
  if (eventId) return `/eventos/${encodeURIComponent(eventId)}?tab=escala`;

  return '';
}

function findScaleEventHref(target) {
  const clicked = target instanceof Element ? target : null;
  if (!clicked) return '';

  const button = clicked.closest('button, a');
  if (!button || !isScaleActionButton(button)) return '';

  if (button.tagName === 'A') {
    const href = button.getAttribute('href') || '';
    if (href.startsWith('/eventos/')) {
      const [path] = href.split('?');
      return `${path}?tab=escala`;
    }
  }

  return findNearestEventHref(button);
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
