'use client';

import { useEffect } from 'react';

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

function isContractPreviewIframe(iframe) {
  const title = String(iframe?.getAttribute?.('title') || '');
  const srcDoc = String(iframe?.getAttribute?.('srcdoc') || iframe?.srcdoc || '');

  return (
    title.includes('Prévia do contrato') ||
    srcDoc.includes('class="page"') ||
    srcDoc.includes("class='page'") ||
    srcDoc.includes('210mm')
  );
}

function rewriteSrcDocWithoutArtificialPage(iframe) {
  const currentSrcDoc = String(iframe?.getAttribute?.('srcdoc') || iframe?.srcdoc || '');
  if (!currentSrcDoc || iframe.dataset.contractPreviewSrcdocRewritten === currentSrcDoc) return;

  const hasArtificialPage =
    currentSrcDoc.includes('class="page"') ||
    currentSrcDoc.includes("class='page'") ||
    currentSrcDoc.includes('210mm') ||
    currentSrcDoc.includes('box-shadow');

  if (!hasArtificialPage) return;

  const parser = new DOMParser();
  const parsed = parser.parseFromString(currentSrcDoc, 'text/html');
  const page = parsed.body?.querySelector?.(':scope > .page');
  const content = page ? page.innerHTML : parsed.body?.innerHTML || '';

  const nextSrcDoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style id="${STYLE_ID}">${PREVIEW_CSS}</style>
</head>
<body>${content}</body>
</html>`;

  iframe.dataset.contractPreviewSrcdocRewritten = nextSrcDoc;
  iframe.setAttribute('srcdoc', nextSrcDoc);
}

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
  if (!iframe || !isContractPreviewIframe(iframe)) return;

  try {
    iframe.setAttribute('scrolling', 'yes');
    rewriteSrcDocWithoutArtificialPage(iframe);
    window.setTimeout(() => normalizePreviewDocument(iframe), 0);
    window.setTimeout(() => normalizePreviewDocument(iframe), 80);
    window.setTimeout(() => normalizePreviewDocument(iframe), 250);
  } catch {
    // srcDoc preview is same-origin; keep defensive.
  }
}

function patchContractPreviewIframes() {
  if (typeof document === 'undefined') return;

  document.querySelectorAll('iframe').forEach((iframe) => {
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
      attributes: true,
      attributeFilter: ['srcdoc', 'title'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
