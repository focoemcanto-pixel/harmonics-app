'use client';

import { useEffect } from 'react';

const PREVIEW_IFRAME_SELECTOR = 'iframe[title="Prévia do contrato"]';
const STYLE_ID = 'harmonics-contract-preview-scale-fix';
const INNER_SCALE_CLASS = 'harmonics-preview-inner-scale';
const PAGE_SPACER_CLASS = 'harmonics-preview-page-spacer';

const SCALE_ONLY_CSS = `
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    min-height: 100% !important;
    background: #eef2f7 !important;
    overflow: visible !important;
  }

  .page,
  .contract-page,
  [class*="page"] {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }

  .${INNER_SCALE_CLASS} {
    display: block !important;
  }

  .${PAGE_SPACER_CLASS} {
    display: none !important;
  }
`;

function ensureInnerScaleWrapper(doc) {
  const page = doc?.querySelector?.('.page');
  if (!page) return null;

  let wrapper = page.querySelector(`:scope > .${INNER_SCALE_CLASS}`);
  if (wrapper) return { page, wrapper };

  wrapper = doc.createElement('div');
  wrapper.className = INNER_SCALE_CLASS;

  const nodes = Array.from(page.childNodes).filter((node) => {
    return !(node.nodeType === 1 && node.classList?.contains(PAGE_SPACER_CLASS));
  });

  nodes.forEach((node) => wrapper.appendChild(node));
  page.appendChild(wrapper);

  let spacer = page.querySelector(`:scope > .${PAGE_SPACER_CLASS}`);
  if (!spacer) {
    spacer = doc.createElement('div');
    spacer.className = PAGE_SPACER_CLASS;
    page.appendChild(spacer);
  }

  return { page, wrapper };
}

function getDocumentHeight(doc) {
  const body = doc?.body;
  const html = doc?.documentElement;
  const page = doc?.querySelector?.('.page');

  return Math.max(
    body?.scrollHeight || 0,
    body?.offsetHeight || 0,
    html?.scrollHeight || 0,
    html?.offsetHeight || 0,
    page?.scrollHeight || 0,
    page?.offsetHeight || 0,
    700
  );
}

function patchPreviewModalWrappers(iframe) {
  let current = iframe?.parentElement;
  let depth = 0;

  while (current && depth < 8) {
    const className = String(current.className || '');
    const isPreviewShell =
      className.includes('overflow-hidden') ||
      className.includes('h-[100dvh]') ||
      className.includes('h-[92vh]') ||
      className.includes('max-w-[210mm]') ||
      className.includes('flex-1');

    if (isPreviewShell) {
      current.style.overflow = 'visible';
      current.style.maxHeight = 'none';
    }

    if (className.includes('flex-1')) {
      current.style.overflowY = 'auto';
    }

    current = current.parentElement;
    depth += 1;
  }
}

function resizePreviewIframe(iframe, doc) {
  const height = getDocumentHeight(doc);
  iframe.setAttribute('scrolling', 'no');
  iframe.style.width = '100%';
  iframe.style.maxWidth = '100%';
  iframe.style.height = `${height + 80}px`;
  iframe.style.minHeight = `${Math.min(height + 80, 900)}px`;
  iframe.style.overflow = 'visible';
  patchPreviewModalWrappers(iframe);
}

function syncContractScale(iframe) {
  try {
    const doc = iframe?.contentDocument;
    if (!doc?.head || !doc?.body) return;

    let style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement('style');
      style.id = STYLE_ID;
      doc.head.appendChild(style);
    }
    style.textContent = SCALE_ONLY_CSS;

    const result = ensureInnerScaleWrapper(doc);
    if (result?.wrapper) {
      result.wrapper.style.transform = 'none';
      result.wrapper.style.width = '';
      result.wrapper.style.maxWidth = '';
    }

    window.requestAnimationFrame(() => resizePreviewIframe(iframe, doc));
  } catch {
    // Same-origin srcDoc is expected, but keep this best-effort.
  }
}

function patchContractPreviewIframes() {
  if (typeof document === 'undefined') return;

  document.querySelectorAll(PREVIEW_IFRAME_SELECTOR).forEach((iframe) => {
    syncContractScale(iframe);
    if (iframe.dataset.contractPreviewScaleFix === 'true') return;

    iframe.dataset.contractPreviewScaleFix = 'true';
    iframe.addEventListener('load', () => {
      window.setTimeout(() => syncContractScale(iframe), 50);
      window.setTimeout(() => syncContractScale(iframe), 300);
      window.setTimeout(() => syncContractScale(iframe), 900);
    });
  });
}

export default function ContractPreviewMobileFix() {
  useEffect(() => {
    patchContractPreviewIframes();

    const observer = new MutationObserver(() => {
      patchContractPreviewIframes();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('resize', patchContractPreviewIframes);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', patchContractPreviewIframes);
    };
  }, []);

  return null;
}
