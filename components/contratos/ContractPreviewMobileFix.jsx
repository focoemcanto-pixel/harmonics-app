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
  iframe.style.height = 'calc(100dvh - 120px)';
  iframe.style.minHeight = '70vh';
  iframe.style.overflow = 'auto';
  iframe.style.overflowY = 'auto';
  iframe.style.display = 'block';
}

function patchModalShell(iframe) {
  let current = iframe?.parentElement;
  let depth = 0;

  while (current && depth < 8) {
    const className = String(current.className || '');

    if (className.includes('max-w-[210mm]')) {
      current.style.overflow = 'hidden';
    }

    current = current.parentElement;
    depth += 1;
  }
}

function bindWheelToIframe(iframe) {
  if (iframe.dataset.contractPreviewWheelFix === 'true') return;
  iframe.dataset.contractPreviewWheelFix = 'true';

  iframe.addEventListener(
    'wheel',
    (event) => {
      try {
        const win = iframe.contentWindow;
        if (!win) return;
        win.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: 'auto' });
      } catch {
        // Ignore cross-context failures.
      }
    },
    { passive: true }
  );
}

function syncContractPreview(iframe) {
  try {
    patchModalShell(iframe);
    patchIframeElement(iframe);
    patchIframeDocument(iframe);
    bindWheelToIframe(iframe);
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
