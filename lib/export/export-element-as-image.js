'use client';

function sanitizeFilenamePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function triggerDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function svgNodeToPngDataUrl(node, scale = 3) {
  const clonedNode = node.cloneNode(true);
  const width = node.offsetWidth;
  const height = node.offsetHeight;

  clonedNode.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="transform: scale(${scale}); transform-origin: top left; width:${width}px; height:${height}px;">
          ${new XMLSerializer().serializeToString(clonedNode)}
        </div>
      </foreignObject>
    </svg>
  `;

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = blobUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas indisponível para gerar a imagem.');
    }

    context.drawImage(image, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function buildDepoimentoFilename(slugOrId) {
  const safePart = sanitizeFilenamePart(slugOrId);
  const suffix = safePart || String(Date.now());
  return `depoimento-harmonics-${suffix}.png`;
}

export async function exportElementAsImage(element, options = {}) {
  if (!element) {
    throw new Error('Elemento de exportação não encontrado.');
  }

  const { filename = `depoimento-harmonics-${Date.now()}.png`, scale = 3 } = options;
  const imageDataUrl = await svgNodeToPngDataUrl(element, scale);

  triggerDownload(imageDataUrl, filename);
  return imageDataUrl;
}
