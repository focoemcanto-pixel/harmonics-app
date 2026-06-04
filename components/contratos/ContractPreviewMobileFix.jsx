'use client';

import { useEffect } from 'react';

function getPublicContractToken() {
  if (typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/').filter(Boolean);
  const contratoIndex = parts.findIndex((part) => part === 'contrato');
  if (contratoIndex < 0) return '';
  return parts[contratoIndex + 1] || '';
}

function getPreviewPdfUrl() {
  const token = getPublicContractToken();
  if (!token) return '';
  return `/api/contracts/preview/${encodeURIComponent(token)}`;
}

function findButtonByText(textFragment) {
  const normalizedFragment = String(textFragment || '').toLowerCase();
  return Array.from(document.querySelectorAll('button')).find((button) => {
    return String(button.textContent || '').toLowerCase().includes(normalizedFragment);
  });
}

function getContractViewerCard() {
  const previewButton = findButtonByText('visualizar contrato');
  if (!previewButton) return null;
  return previewButton.closest('[class*="rounded"]') || previewButton.parentElement;
}

function setContractReadStatus(card) {
  const statusNode = Array.from(card?.querySelectorAll?.('p') || []).find((node) => {
    return String(node.textContent || '').toLowerCase().includes('status:');
  });

  if (statusNode) {
    statusNode.textContent = 'Status: em leitura';
  }
}

function ensureInlinePreviewPanel() {
  const card = getContractViewerCard();
  const pdfUrl = getPreviewPdfUrl();
  if (!card || !pdfUrl) return null;

  let panel = card.querySelector('[data-inline-contract-pdf-preview="true"]');
  if (panel) return panel;

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
  head.textContent = 'Prévia do PDF';
  head.style.padding = '12px 14px';
  head.style.borderBottom = '1px solid #e2e8f0';
  head.style.fontSize = '13px';
  head.style.fontWeight = '800';
  head.style.color = '#64748b';
  head.style.background = '#faf5ff';

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Prévia do PDF do contrato');
  iframe.setAttribute('data-inline-contract-pdf-frame', 'true');
  iframe.setAttribute('loading', 'lazy');
  iframe.style.width = '100%';
  iframe.style.height = '72vh';
  iframe.style.border = '0';
  iframe.style.display = 'block';
  iframe.style.background = '#fff';

  panel.appendChild(head);
  panel.appendChild(iframe);
  card.appendChild(panel);

  return panel;
}

function openInlinePdfPreview() {
  const pdfUrl = getPreviewPdfUrl();
  const panel = ensureInlinePreviewPanel();
  if (!pdfUrl || !panel) return;

  const iframe = panel.querySelector('[data-inline-contract-pdf-frame="true"]');
  if (iframe && iframe.getAttribute('src') !== pdfUrl) {
    iframe.setAttribute('src', pdfUrl);
  }

  panel.style.display = 'block';
  setContractReadStatus(getContractViewerCard());

  window.setTimeout(() => {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

function openPdfInNewTab() {
  const pdfUrl = getPreviewPdfUrl();
  if (!pdfUrl) return;
  window.open(pdfUrl, '_blank', 'noopener,noreferrer');
}

function ensureOpenFullButton() {
  const previewButton = findButtonByText('visualizar contrato');
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
  const previewButton = findButtonByText('visualizar contrato');
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

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
