'use client';

import { useEffect } from 'react';

const PREVIEW_IFRAME_SELECTOR = 'iframe[title="Prévia do contrato"]';
const STYLE_ID = 'harmonics-contract-preview-normalize';

const PREVIEW_CSS = `
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    overflow-y: auto !important;
  }

  body {
    box-sizing: border-box !important;
  }
`;

function unwrapArtificialPage(doc) {
  const body = doc?.body;
  const page = body?.querySelector(':scope > .page');
  if (!body || !page) return;

  while (page.firstChild) {
    body.insertBefore(page.firstChild, page);
  }

  page.remove();
}

function removeArtificialPreviewStyles(doc) {
  doc?.querySelectorAll?.('style').forEach((style) => {
    const text = style.textContent || '';
    const isArtificialA4PreviewStyle =
      text.includes('.page') &&
      text.includes('210mm') &&
      text.includes('box-shadow');

    if (isArtificialA4PreviewStyle) {
      style.remove();
    }
  });
}

function normalizePreviewDocument(iframe) {
  const doc = iframe?.contentDocument;
  if (!doc?.head || !doc?.body) return;

  unwrapArtificialPage(doc);
  removeArtificialPreviewStyles(doc);

  let style = doc.getElementById(STYLE_ID);
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }

  style.textContent = PREVIEW_CSS;
  doc.documentElement.style.background = '#fff';
  doc.documentElement.style.overflowY = 'auto';
  doc.body.style.background = '#fff';
  doc.body.style.overflowY = 'auto';
}

function syncContractPreview(iframe) {
  try {
    iframe.setAttribute('scrolling', 'yes');
    normalizePreviewDocument(iframe);
  } catch {
    // srcDoc preview is same-origin; keep defensive.
  }
}

function patchContractPreviewIframes() {
  if (typeof document === 'undefined') return;

  document.querySelectorAll(PREVIEW_IFRAME_SELECTOR).forEach((iframe) => {
    syncContractPreview(iframe);

    if (iframe.dataset.contractPreviewNormalize === 'true') return;
    iframe.dataset.contractPreviewNormalize = 'true';

    iframe.addEventListener('load', () => {
      window.setTimeout(() => syncContractPreview(iframe), 50);
      window.setTimeout(() => syncContractPreview(iframe), 300);
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

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
