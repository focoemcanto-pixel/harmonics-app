'use client';

import html2canvas from 'html2canvas';

export async function exportDepoimentoAsImage(
  elementId = 'depoimento-card',
  { fileName = 'harmonics-depoimento.png', download = true, format } = {}
) {
  try {
    const element = document.getElementById(elementId);

    if (!element) {
      throw new Error('Elemento do depoimento não encontrado');
    }

    if (document?.fonts?.ready) {
      await document.fonts.ready;
    }

    const images = Array.from(element.querySelectorAll('img'));
    if (images.length) {
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const targetWidth = Number(format?.width) || element.scrollWidth || element.offsetWidth;
    const targetHeight = Number(format?.height) || element.scrollHeight || element.offsetHeight;

    if (!targetWidth || !targetHeight) {
      throw new Error('Dimensões inválidas para exportação');
    }

    const previousStyle = element.getAttribute('style') || '';
    element.style.width = `${targetWidth}px`;
    element.style.height = `${targetHeight}px`;
    element.style.maxWidth = `${targetWidth}px`;
    element.style.maxHeight = `${targetHeight}px`;

    let canvas;
    try {
      canvas = await html2canvas(element, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        width: targetWidth,
        height: targetHeight,
        windowWidth: targetWidth,
        windowHeight: targetHeight,
      });
    } finally {
      element.setAttribute('style', previousStyle);
    }

    const dataUrl = canvas.toDataURL('image/png');

    if (download) {
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    return { ok: true, dataUrl };
  } catch (error) {
    const details = {
      elementId,
      message: error?.message,
      stack: error?.stack,
    };
    console.error('[exportDepoimentoAsImage] erro:', details);
    return { ok: false, error: error?.message || 'Erro inesperado ao exportar', details };
  }
}
