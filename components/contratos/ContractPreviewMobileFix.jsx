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
    overflow-x: hidden !important;
  }

  .page {
    width: 100% !important;
    max-width: 100% !important;
    min-height: 0 !important;
    margin: 0 auto !important;
    padding: 12px !important;
    overflow: visible !important;
    box-sizing: border-box !important;
    background: #ffffff !important;
  }

  .${INNER_SCALE_CLASS} {
    display: block !important;
    transform-origin: top left !important;
    will-change: transform !important;
  }

  .${PAGE_SPACER_CLASS} {
    display: block !important;
    width: 1px !important;
    pointer-events: none !important;
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

    const { page, wrapper } = result;
    const spacer = page.querySelector(`:scope > .${PAGE_SPACER_CLASS}`);

    wrapper.style.transform = 'none';
    wrapper.style.width = 'max-content';
    wrapper.style.maxWidth = 'none';

    const viewportWidth = Math.max(280, iframe.clientWidth || window.innerWidth || 360);
    const availableWidth = Math.max(240, viewportWidth - 24);
    const contentWidth = Math.max(
      wrapper.scrollWidth,
      wrapper.getBoundingClientRect().width,
      1
    );
    const contentHeight = Math.max(
      wrapper.scrollHeight,
      wrapper.getBoundingClientRect().height,
      1
    );
    const scale = Math.min(1, availableWidth / contentWidth);

    wrapper.style.transform = `scale(${scale})`;

    if (spacer) {
      spacer.style.height = `${Math.ceil(contentHeight * scale) + 24}px`;
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
