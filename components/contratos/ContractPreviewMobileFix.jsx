'use client';

import { useEffect } from 'react';

function getPublicContractToken() {
  if (typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/').filter(Boolean);
  const contratoIndex = parts.findIndex((part) => part === 'contrato');
  if (contratoIndex < 0) return '';
  return parts[contratoIndex + 1] || '';
}

function buildTokenUrl(path, { cacheBust = false } = {}) {
  const token = getPublicContractToken();
  if (!token) return '';
  const baseUrl = `${path}/${encodeURIComponent(token)}`;
  return cacheBust ? `${baseUrl}?t=${Date.now()}` : baseUrl;
}

function getPreviewHtmlUrl({ cacheBust = false } = {}) {
  return buildTokenUrl('/api/contracts/preview-html', { cacheBust });
}

function getPreviewPdfUrl({ cacheBust = false } = {}) {
  return buildTokenUrl('/api/contracts/preview', { cacheBust });
}

function findButtonByText(textFragment) {
  const normalizedFragment = String(textFragment || '').toLowerCase();
  return Array.from(document.querySelectorAll('button')).find((button) => {
    return String(button.textContent || '').toLowerCase().includes(normalizedFragment);
  });
}

function getPreviewButton() {
  return (
    document.querySelector('button[data-inline-pdf-preview-patched="true"]') ||
    findButtonByText('visualizar contrato') ||
    findButtonByText('ver prévia aqui')
  );
}

function getContractViewerCard() {
  const previewButton = getPreviewButton();
  if (!previewButton) return null;

  return (
    previewButton.closest('[data-onboarding-tour="contract-viewer"]') ||
    previewButton.closest('.space-y-3') ||
    previewButton.closest('[class*="rounded"]') ||
    previewButton.parentElement
  );
}

function setContractReadStatus(card) {
  const statusNode = Array.from(card?.querySelectorAll?.('p') || []).find((node) => {
    return String(node.textContent || '').toLowerCase().includes('status:');
  });

  if (statusNode) {
    statusNode.textContent = 'Status: em leitura';
  }
}

function getInlinePreviewHeight() {
  if (typeof window === 'undefined') return '72vh';
  const isMobile = window.matchMedia?.('(max-width: 767px)').matches || window.innerWidth < 768;
  return isMobile ? '88vh' : '72vh';
}

function styleFrame(frame) {
  frame.style.width = '100%';
  frame.style.minWidth = '0';
  frame.style.maxWidth = '100%';
  frame.style.height = getInlinePreviewHeight();
  frame.style.border = '0';
  frame.style.display = 'block';
  frame.style.background = '#fff';
}

function ensureInlinePreviewPanel() {
  const card = getContractViewerCard();
  const previewUrl = getPreviewHtmlUrl();
  if (!card || !previewUrl) return null;

  let panel = card.querySelector('[data-inline-contract-pdf-preview="true"]');
  if (panel) {
    const existingFrame = panel.querySelector('[data-inline-contract-pdf-frame="true"]');
    if (existingFrame) styleFrame(existingFrame);
    return panel;
  }

  panel = document.createElement('div');
  panel.setAttribute('data-inline-contract-pdf-preview', 'true');
  panel.style.display = 'none';
  panel.style.marginTop = '14px';
  panel.style.border = '1px solid #e2e8f0';
  panel.style.borderRadius = '20px';
  panel.style.overflow = 'hidden';
  panel.style.background = '#fff';
  panel.style.boxShadow = '0 10px 26px rgba(15,23,42,.10)';

  const head = document.createElement('div');
  head.textContent = 'Prévia do contrato';
  head.style.padding = '12px 14px';
  head.style.borderBottom = '1px solid #e2e8f0';
  head.style.fontSize = '13px';
  head.style.fontWeight = '800';
  head.style.color = '#64748b';
  head.style.background = '#faf5ff';

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Prévia responsiva do contrato');
  iframe.setAttribute('data-inline-contract-pdf-frame', 'true');
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('scrolling', 'yes');
  styleFrame(iframe);

  panel.appendChild(head);
  panel.appendChild(iframe);
  card.appendChild(panel);

  return panel;
}

function openInlinePdfPreview() {
  const previewUrl = getPreviewHtmlUrl({ cacheBust: true });
  const panel = ensureInlinePreviewPanel();
  if (!previewUrl || !panel) return;

  const iframe = panel.querySelector('[data-inline-contract-pdf-frame="true"]');
  if (iframe) {
    styleFrame(iframe);
    iframe.setAttribute('src', previewUrl);
  }

  panel.style.display = 'block';
  setContractReadStatus(getContractViewerCard());

  window.setTimeout(() => {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

function openPdfInNewTab() {
  const pdfUrl = getPreviewPdfUrl({ cacheBust: true });
  if (!pdfUrl) return;
  window.open(pdfUrl, '_blank', 'noopener,noreferrer');
}

function ensureOpenFullButton() {
  const previewButton = getPreviewButton();
  if (!previewButton) return;

  const parent = previewButton.parentElement;
  if (!parent || parent.querySelector('[data-open-full-contract-pdf="true"]')) return;

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.setAttribute('data-open-full-contract-pdf', 'true');
  openButton.textContent = '🔗 Abrir contrato completo';
  openButton.className = previewButton.className || '';
  openButton.style.marginTop = '10px';
  openButton.style.background = '#fff';
  openButton.style.color = '#111827';
  openButton.style.border = '1px solid #e2e8f0';

  openButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openPdfInNewTab();
  });

  parent.appendChild(openButton);
}

function removeReactPreviewModalIfOpened() {
  document.querySelectorAll('iframe[title="Prévia do contrato"]').forEach((iframe) => {
    const overlay = iframe.closest('.fixed.inset-0');
    if (!overlay) return;

    overlay.style.display = 'none';

    const closeButton = Array.from(overlay.querySelectorAll('button')).find((button) => {
      return String(button.textContent || '').toLowerCase().includes('fechar');
    });

    if (closeButton) {
      closeButton.click();
    }
  });
}

function patchPreviewButtonBehavior() {
  const previewButton = getPreviewButton();
  if (!previewButton || previewButton.dataset.inlinePdfPreviewPatched === 'true') return;

  previewButton.dataset.inlinePdfPreviewPatched = 'true';
  previewButton.textContent = '📄 Ver prévia aqui';

  previewButton.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openInlinePdfPreview();
    },
    true
  );
}

function patchPublicContractPreview() {
  if (typeof document === 'undefined') return;
  if (!getPublicContractToken()) return;

  patchPreviewButtonBehavior();
  ensureOpenFullButton();
  removeReactPreviewModalIfOpened();
}

export default function ContractPreviewMobileFix() {
  useEffect(() => {
    patchPublicContractPreview();

    const observer = new MutationObserver(() => {
      patchPublicContractPreview();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('resize', patchPublicContractPreview);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', patchPublicContractPreview);
    };
  }, []);

  return null;
}
