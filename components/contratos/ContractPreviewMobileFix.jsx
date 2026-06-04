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
    background: #eef2f7 !important;
    overflow: auto !important;
  }

  .page {
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
    if (!result?.page || !result?.wrapper) return;

    const { wrapper } = result;
    wrapper.style.transform = 'none';
    wrapper.style.width = '';
    wrapper.style.maxWidth = '';

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
