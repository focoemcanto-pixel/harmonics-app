'use client';

import { useEffect } from 'react';

const PREVIEW_IFRAME_SELECTOR = 'iframe[title="Prévia do contrato"]';
const STYLE_ID = 'harmonics-contract-preview-scale-fix';

const SCALE_ONLY_CSS = `
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #eef2f7 !important;
    overflow-x: hidden !important;
  }

  body {
    min-width: 0 !important;
  }

  .harmonics-preview-scale-stage {
    width: 100% !important;
    min-width: 0 !important;
    overflow-x: hidden !important;
    display: flex !important;
    justify-content: center !important;
    align-items: flex-start !important;
  }

  .page {
    transform-origin: top center !important;
    will-change: transform !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
`;

function ensureScaleStage(doc) {
  const page = doc?.querySelector?.('.page');
  if (!page || page.parentElement?.classList?.contains('harmonics-preview-scale-stage')) {
    return page;
  }

  const stage = doc.createElement('div');
  stage.className = 'harmonics-preview-scale-stage';
  page.parentNode.insertBefore(stage, page);
  stage.appendChild(page);
  return page;
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

    const page = ensureScaleStage(doc);
    if (!page) return;

    page.style.transform = 'none';
    page.style.maxWidth = '';
    page.style.overflow = '';

    const viewportWidth = Math.max(280, iframe.clientWidth || window.innerWidth || 360);
    const pageWidth = Math.max(page.scrollWidth, page.getBoundingClientRect().width, 1);
    const availableWidth = Math.max(260, viewportWidth - 24);
    const scale = Math.min(1, availableWidth / pageWidth);

    page.style.transform = `scale(${scale})`;
    page.style.marginTop = '12px';
    page.style.marginBottom = `${Math.max(12, Math.round((page.scrollHeight * scale) - page.scrollHeight + 12))}px`;

    const stage = page.parentElement;
    if (stage?.classList?.contains('harmonics-preview-scale-stage')) {
      stage.style.height = `${Math.ceil(page.scrollHeight * scale) + 24}px`;
    }

    iframe.setAttribute('scrolling', 'yes');
    iframe.style.width = '100%';
    iframe.style.maxWidth = '100%';
    iframe.style.overflow = 'auto';
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
    });
  });
}

export default function ContractPreviewMobileFix() {
  useEffect(() => {
    patchContractPreviewIframes();

    const observer = new MutationObserver(() => {
      patchContractPreviewIframes();
    });

    const handleResize = () => patchContractPreviewIframes();

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return null;
}
