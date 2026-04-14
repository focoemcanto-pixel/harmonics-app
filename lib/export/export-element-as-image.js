'use client';

import html2canvas from 'html2canvas';

export async function exportDepoimentoAsImage(
  elementId = 'depoimento-card',
  { fileName = 'harmonics-depoimento.png', download = true } = {}
) {
  try {
    const element = document.getElementById(elementId);

    if (!element) {
      throw new Error('Elemento do depoimento não encontrado');
    }

    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
    });

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
    console.error('[exportDepoimentoAsImage] erro:', error);
    return { ok: false, error: error.message };
  }
}
