'use client';

import { useEffect } from 'react';

const PREVIEW_IFRAME_SELECTOR = 'iframe[title="Prévia do contrato"]';
const STYLE_ID = 'harmonics-contract-preview-mobile-fix';

const RESPONSIVE_PREVIEW_CSS = `
  html,
  body {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow-x: hidden !important;
    -webkit-text-size-adjust: 100% !important;
    background: #eef2f7 !important;
  }

  body {
    box-sizing: border-box !important;
  }

  .page {
    width: 100% !important;
    max-width: min(210mm, 100%) !important;
    min-width: 0 !important;
    min-height: auto !important;
    margin: 0 auto !important;
    padding: clamp(16px, 4vw, 32px) !important;
    box-sizing: border-box !important;
    overflow: visible !important;
    background: #ffffff !important;
  }

  .page,
  .page * {
    box-sizing: border-box !important;
    max-width: 100% !important;
    overflow-wrap: anywhere !important;
    word-break: normal !important;
    white-space: normal !important;
  }

  .page img,
  .page svg,
  .page canvas,
  .page video {
    max-width: 100% !important;
    height: auto !important;
  }

  .page table {
    width: 100% !important;
    max-width: 100% !important;
    table-layout: auto !important;
    border-collapse: collapse !important;
    display: block !important;
    overflow-x: auto !important;
  }

  .page td,
  .page th {
    max-width: 100% !important;
    white-space: normal !important;
  }

  @media (max-width: 640px) {
    .page {
      width: 100% !important;
      margin: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }

    .page h1,
    .page h2,
    .page h3 {
      line-height: 1.15 !important;
      overflow-wrap: anywhere !important;
    }
  }
`;

function injectResponsiveStyles(iframe) {
  try {
    const doc = iframe?.contentDocument;
    if (!doc?.head) return;

    const existing = doc.getElementById(STYLE_ID);
    if (existing) {
      existing.textContent = RESPONSIVE_PREVIEW_CSS;
    } else {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = RESPONSIVE_PREVIEW_CSS;
      doc.head.appendChild(style);
    }

    iframe.setAttribute('scrolling', 'yes');
    iframe.style.width = '100%';
    iframe.style.maxWidth = '100%';
    iframe.style.overflow = 'auto';
  } catch {
    // srcDoc iframes are same-origin, but this remains best-effort for safety.
  }
}

function patchContractPreviewIframes() {
  if (typeof document === 'undefined') return;

  document.querySelectorAll(PREVIEW_IFRAME_SELECTOR).forEach((iframe) => {
    injectResponsiveStyles(iframe);
    if (iframe.dataset.contractPreviewMobileFix === 'true') return;

    iframe.dataset.contractPreviewMobileFix = 'true';
    iframe.addEventListener('load', () => injectResponsiveStyles(iframe));
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

    return () => observer.disconnect();
  }, []);

  return null;
}
