'use client';

import { useEffect } from 'react';

const PREVIEW_IFRAME_SELECTOR = 'iframe[title="Prévia do contrato"]';
const STYLE_ID = 'harmonics-contract-preview-scroll-fix';

const PREVIEW_CSS = `
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    min-height: 100% !important;
    background: #eef2f7 !important;
    overflow: auto !important;
    overflow-y: auto !important;
  }

  .page,
  .contract-page,
  [class*="page"] {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
`;

function patchIframeDocument(iframe) {
  const doc = iframe?.contentDocument;
  if (!doc?.head || !doc?.body) return;

  let style = doc.getElementById(STYLE_ID);
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }

  style.textContent = PREVIEW_CSS;
  doc.documentElement.style.height = 'auto';
  doc.documentElement.style.overflow = 'auto';
  doc.documentElement.style.overflowY = 'auto';
  doc.body.style.height = 'auto';
  doc.body.style.overflow = 'auto';
  doc.body.style.overflowY = 'auto';
}

function patchIframeElement(iframe) {
  iframe.setAttribute('scrolling', 'yes');
  iframe.style.width = '100%';
  iframe.style.maxWidth = '100%';
  iframe.style.height = '';
  iframe.style.minHeight = '';
  iframe.style.overflow = 'auto';
  iframe.style.overflowY = 'auto';
}

function patchModalShell(iframe) {
  let current = iframe?.parentElement;
  let depth = 0;

  while (current && depth < 8) {
    const className = String(current.className || '');

    if (className.includes('fixed') && className.includes('inset-0')) {
      current.style.alignItems = '';
      current.style.justifyContent = '';
      current.style.overflow = '';
      current.style.overflowY = '';
      current.style.paddingTop = '';
      current.style.paddingBottom = '';
    }

    if (className.includes('h-[100dvh]') || className.includes('h-[92vh]')) {
      current.style.height = '';
      current.style.minHeight = '';
      current.style.maxHeight = '';
      current.style.overflow = '';
    }

    if (className.includes('flex-1')) {
      current.style.height = '';
      current.style.maxHeight = '';
      current.style.overflow = '';
      current.style.overflowY = '';
    }

    if (className.includes('max-w-[210mm]') || className.includes('overflow-hidden')) {
      current.style.overflow = '';
      current.style.maxHeight = '';
    }

    current = current.parentElement;
    depth += 1;
  }
}

function syncContractPreview(iframe) {
  try {
    patchModalShell(iframe);
    patchIframeElement(iframe);
    patchIframeDocument(iframe);
  } catch {
    // The preview uses same-origin srcDoc, but keep this best-effort.
  }
}

function patchContractPreviewIframes() {
  if (typeof document === 'undefined') return;

  document.querySelectorAll(PREVIEW_IFRAME_SELECTOR).forEach((iframe) => {
    syncContractPreview(iframe);

    if (iframe.dataset.contractPreviewScrollFix === 'true') return;
    iframe.dataset.contractPreviewScrollFix = 'true';

    iframe.addEventListener('load', () => {
      window.setTimeout(() => syncContractPreview(iframe), 50);
      window.setTimeout(() => syncContractPreview(iframe), 300);
      window.setTimeout(() => syncContractPreview(iframe), 900);
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
