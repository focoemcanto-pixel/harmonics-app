'use client';

import { useEffect } from 'react';

function getClientTokenFromPath() {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(/^\/cliente\/([^/]+)\/repertorio/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

function showFloatingNotice(message, tone = 'success') {
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.textContent = message;
  el.style.position = 'fixed';
  el.style.left = '16px';
  el.style.right = '16px';
  el.style.bottom = '96px';
  el.style.zIndex = '99999';
  el.style.margin = '0 auto';
  el.style.maxWidth = '520px';
  el.style.borderRadius = '18px';
  el.style.padding = '14px 16px';
  el.style.textAlign = 'center';
  el.style.fontWeight = '800';
  el.style.fontSize = '14px';
  el.style.boxShadow = '0 18px 45px rgba(15,23,42,0.18)';
  el.style.background = tone === 'error' ? '#fef2f2' : '#ecfdf5';
  el.style.color = tone === 'error' ? '#991b1b' : '#065f46';
  el.style.border = tone === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0';
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 4200);
}

function findAntesalaCard(target) {
  let node = target;
  for (let i = 0; i < 8 && node; i += 1) {
    const text = String(node.textContent || '');
    if (text.includes('Antesala') && text.includes('Seu contrato possui antesala')) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function extractReceptionHoursFromNextPayload() {
  if (typeof document === 'undefined') return 0;
  const html = document.documentElement.innerHTML || '';
  const patterns = [
    /"receptivoContratadoHoras"\s*:\s*(\d+(?:\.\d+)?)/,
    /receptivoContratadoHoras\\?"\s*:\s*(\d+(?:\.\d+)?)/,
    /"duracao"\s*:\s*"(\d+(?:\.\d+)?)h"/,
    /duracao\\?"\s*:\s*\\?"(\d+(?:\.\d+)?)h\\?"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = Number(match?.[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}

function patchReceptionSummary() {
  if (typeof document === 'undefined') return;
  if (!/^\/cliente\/[^/]+\/repertorio/.test(window.location.pathname)) return;

  const hours = extractReceptionHoursFromNextPayload();
  if (!hours) return;

  const candidates = Array.from(document.querySelectorAll('div,span,p'));
  candidates.forEach((node) => {
    const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text.includes('RECEPTIVO')) return;

    const card = node.closest('div');
    const scope = card?.parentElement || card || node;
    const valueNodes = Array.from(scope.querySelectorAll('div,span,p'));
    valueNodes.forEach((valueNode) => {
      const valueText = String(valueNode.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^Sim\s*[—-]\s*0h$/i.test(valueText) || /^Sim$/i.test(valueText)) {
        valueNode.textContent = `Sim — ${hours}h`;
      }
    });
  });
}

export default function ClientRepertoireHotfixes() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!/^\/cliente\/[^/]+\/repertorio/.test(window.location.pathname)) return undefined;

    let isRequestingAntesala = false;

    const handleClickCapture = async (event) => {
      const button = event.target?.closest?.('button');
      if (!button) return;
      const label = String(button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (label !== 'sim') return;

      const card = findAntesalaCard(button);
      if (!card) return;

      // Quando a antessala já foi liberada pelo admin, o bloco contém o campo de duração e deve funcionar normalmente.
      if (String(card.textContent || '').includes('Tempo da antesala')) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      if (isRequestingAntesala) return;
      const token = getClientTokenFromPath();
      if (!token) {
        showFloatingNotice('Não foi possível identificar este repertório. Fale com nossa equipe.', 'error');
        return;
      }

      isRequestingAntesala = true;
      button.setAttribute('disabled', 'disabled');
      const previousText = button.textContent;
      button.textContent = 'Solicitando...';

      try {
        const response = await fetch('/api/cliente/antesala/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || 'Erro ao solicitar abertura da antessala.');
        }
        showFloatingNotice('Solicitação enviada! Nossa equipe vai avaliar e liberar o bloco se estiver contratado.');
        button.textContent = 'Solicitado';
      } catch (error) {
        showFloatingNotice(error?.message || 'Erro ao solicitar abertura da antessala.', 'error');
        button.textContent = previousText;
        button.removeAttribute('disabled');
      } finally {
        isRequestingAntesala = false;
      }
    };

    patchReceptionSummary();
    const observer = new MutationObserver(() => patchReceptionSummary());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('click', handleClickCapture, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', handleClickCapture, true);
    };
  }, []);

  return null;
}
